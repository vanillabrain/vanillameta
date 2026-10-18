import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { lockMetricSources } from '../metric/metric-write-lock';
import { serializeMetadataWork, metadataTransaction } from '../common/metadata-work';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { sourceRevision } from './source-revision';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { conditionPopulation, sourceConditionProfile } from './source-condition-profile';
import { compileConditionDefinition, conditionColumns } from './source-condition-definition';

const conflict = () =>
  new ConflictException(
    '데이터나 저장 조건이 변경됐습니다. 입력을 보존하고 최신 저장본을 확인해 주세요.',
  );
@Injectable()
export class SourceConditionsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
  ) {}
  private fields(input: unknown, allowed: string[]): Record<string, any> {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      Reflect.ownKeys(input).some(key => typeof key !== 'string' || !allowed.includes(key))
    )
      throw new BadRequestException('조건 요청을 확인해 주세요.');
    return input;
  }
  private async capture(source: unknown, actor: number, action: 'read' | 'edit') {
    return serializeMetadataWork(this.db, async () => {
      this.access.actor(actor);
      const id = this.access.id(source);
      await this.access.assert('database', id, actor, action);
      const row = await this.db.getRepository(Database).findOne({ where: { id } });
      if (!row || row.engine !== 'duckdb')
        throw new BadRequestException('서버에 저장한 DuckDB 소스를 선택해 주세요.');
      const pin = await this.connection.captureDuckDBSnapshot(id);
      const version = await pin.run(() => this.connection.duckDBVersion(id));
      const entry = await this.db
        .getRepository(SourceConditionEntry)
        .findOne({ where: { sourceId: id }, order: { version: 'DESC' } });
      return {
        id,
        sourceBasis: JSON.stringify(row),
        profile: { dataVersion: sourceRevision(row, version) },
        entry,
        pin,
      };
    });
  }
  private async snapshot(source: unknown, actor: number, action: 'read' | 'edit') {
    const captured = await this.capture(source, actor, action);
    // DESCRIBE and population SQL run outside the metadata lease against the captured file.
    const schema = await captured.pin.run(() =>
      this.connection.queryDuckDB(captured.id, 'DESCRIBE uploaded_data'),
    );
    if (!schema.datas.length || schema.datas.length > 128)
      throw new BadRequestException('지원 컬럼 수는 1~128개입니다.');
    const columns = conditionColumns(
      schema.datas.map(c => ({ name: c.column_name, type: c.column_type })),
    );
    return { ...captured, columns };
  }
  private stored(entry: SourceConditionEntry | null, columns: ReturnType<typeof conditionColumns>) {
    try {
      return compileConditionDefinition(
        entry ? JSON.parse(entry.definition) : { include: null, exclude: null },
        columns,
      ).definition;
    } catch {
      throw new ConflictException(
        '저장 조건을 현재 열에서 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.',
      );
    }
  }
  private response(state: Awaited<ReturnType<SourceConditionsService['snapshot']>>) {
    return {
      sourceId: state.id,
      sourceRevision: state.profile.dataVersion,
      version: state.entry?.version ?? 0,
      definition: this.stored(state.entry, state.columns),
      schemaChanged: !!state.entry && state.entry.sourceRevision !== state.profile.dataVersion,
      columns: state.columns,
    };
  }
  async read(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId']);
    const state = await this.snapshot(input.sourceId, actor, 'read');
    await this.current(
      state.id,
      actor,
      state.profile.dataVersion,
      'read',
      state.entry?.version ?? 0,
    );
    return this.response(state);
  }
  private async prepare(body: unknown, actor: number, action: 'read' | 'edit') {
    const input = this.fields(body, ['sourceId', 'sourceRevision', 'version', 'definition']);
    if (
      !Number.isInteger(input.version) ||
      input.version < 0 ||
      input.version >= 2147483647 ||
      typeof input.sourceRevision !== 'string' ||
      !input.sourceRevision ||
      input.sourceRevision.length > 128
    )
      throw new BadRequestException('조건의 기준 버전을 확인해 주세요.');
    const state = await this.snapshot(input.sourceId, actor, action);
    if (
      input.sourceRevision !== state.profile.dataVersion ||
      input.version !== (state.entry?.version ?? 0)
    )
      throw conflict();
    this.stored(state.entry, state.columns);
    const compiled = compileConditionDefinition(input.definition, state.columns);
    return {
      state,
      compiled,
      draft: {
        sourceId: state.id,
        sourceRevision: input.sourceRevision,
        version: input.version,
        definition: compiled.definition,
      },
    };
  }
  private async current(
    sourceId: number,
    actor: number,
    sourceRevision: string,
    action: 'read' | 'edit',
    expectedVersion?: number,
  ) {
    const latest = await this.capture(sourceId, actor, action);
    if (
      latest.profile.dataVersion !== sourceRevision ||
      (expectedVersion !== undefined && (latest.entry?.version ?? 0) !== expectedVersion)
    )
      throw conflict();
    return latest;
  }
  async preview(body: unknown, actor: number) {
    const { state, compiled, draft } = await this.prepare(body, actor, 'read');
    const result = await state.pin.run(async () => {
      const rows = await this.connection.queryDuckDB(
        state.id,
        `WITH evaluated AS (SELECT (${compiled.includeSql}) AS included, (${compiled.excludeSql}) AS excluded FROM uploaded_data)
        SELECT CAST(COUNT(*) AS VARCHAR) AS total,
        CAST(COUNT(*) FILTER (WHERE included) AS VARCHAR) AS matched,
        CAST(COUNT(*) FILTER (WHERE included AND excluded) AS VARCHAR) AS excluded,
        CAST(COUNT(*) FILTER (WHERE included AND NOT excluded) AS VARCHAR) AS remaining FROM evaluated`,
        compiled.bindings,
      );
      const population = conditionPopulation(rows.datas?.[0]);
      await this.current(state.id, actor, draft.sourceRevision, 'read', draft.version);
      return { draft, population };
    });
    // A file replacement outside the pinned worker snapshot cannot make an old count current.
    await this.current(
      result.draft.sourceId,
      actor,
      result.draft.sourceRevision,
      'read',
      result.draft.version,
    );
    return result;
  }
  async profile(body: unknown, actor: number) {
    const input = this.fields(body, [
      'sourceId',
      'sourceRevision',
      'version',
      'definition',
      'columns',
    ]);
    const { state, compiled, draft } = await this.prepare(
      {
        sourceId: input.sourceId,
        sourceRevision: input.sourceRevision,
        version: input.version,
        definition: input.definition,
      },
      actor,
      'read',
    );
    const result = await state.pin.run(() =>
      sourceConditionProfile({
        schema: state.columns,
        columns: input.columns,
        definition: compiled.definition,
        query: (sql, bindings) => this.connection.queryDuckDB(state.id, sql, bindings),
      }),
    );
    await this.current(state.id, actor, draft.sourceRevision, 'read', draft.version);
    return { draft, ...result };
  }
  async save(body: unknown, actor: number) {
    const { state, compiled, draft } = await this.prepare(body, actor, 'edit');
    await this.current(state.id, actor, draft.sourceRevision, 'edit');
    await metadataTransaction(this.db, async manager => {
      const sources = await lockMetricSources(manager, [state.id]);
      if (JSON.stringify(sources.get(state.id)) !== state.sourceBasis) throw conflict();
      await this.access.assert('database', state.id, actor, 'edit', manager);
      const latest = await manager
        .getRepository(SourceConditionEntry)
        .findOne({ where: { sourceId: state.id }, order: { version: 'DESC' } });
      if ((latest?.version ?? 0) !== draft.version) throw conflict();
      this.stored(latest, state.columns);
      try {
        await manager.getRepository(SourceConditionEntry).insert({
          sourceId: state.id,
          version: draft.version + 1,
          actorId: actor,
          sourceRevision: draft.sourceRevision,
          definition: JSON.stringify(compiled.definition),
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          ((error.driverError as any)?.code === 'ER_DUP_ENTRY' ||
            ((error.driverError as any)?.code === 'SQLITE_CONSTRAINT' &&
              /UNIQUE constraint failed: source_condition_entry/.test(error.message)))
        )
          throw conflict();
        throw error;
      }
    });
    return {
      sourceId: state.id,
      sourceRevision: draft.sourceRevision,
      version: draft.version + 1,
      definition: compiled.definition,
      schemaChanged: false,
      columns: state.columns,
    };
  }
}
