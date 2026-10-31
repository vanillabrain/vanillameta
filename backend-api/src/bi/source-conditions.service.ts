import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
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
import { ConditionSemantics } from './business-condition-semantics';
import { validateStudioConditions } from '../dashboard-studio/studio-document';
import {
  resolveConditionSemantics,
  latestConditionSemantics,
  assertLatestConditionSemantics,
  validateConditionBusinessDates,
} from './business-condition-context';

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
      if (!row) throw new ForbiddenException('Source unavailable.');
      if (row.engine !== 'duckdb')
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
        fileRevision: version,
        entry,
        pin,
      };
    });
  }
  private async snapshot(
    source: unknown,
    actor: number,
    action: 'read' | 'edit',
    analysisContext = false,
  ) {
    const captured = await this.capture(source, actor, action);
    // DESCRIBE and population SQL run outside the metadata lease against the captured file.
    const schema = await captured.pin.run(() =>
      this.connection.queryDuckDB(captured.id, 'DESCRIBE uploaded_data'),
    );
    if (!schema.datas.length || schema.datas.length > 128)
      throw new BadRequestException('지원 컬럼 수는 1~128개입니다.');
    const nativeSchema = schema.datas.map(c => ({ name: c.column_name, type: c.column_type }));
    let frozen: unknown;
    try {
      frozen =
        analysisContext || captured.entry?.semanticsJSON == null
          ? undefined
          : JSON.parse(captured.entry.semanticsJSON);
    } catch {
      throw conflict();
    }
    let semantics: ConditionSemantics | undefined;
    try {
      semantics = analysisContext
        ? undefined
        : captured.entry
        ? await resolveConditionSemantics(this.db.manager, captured.id, nativeSchema, frozen)
        : await latestConditionSemantics(this.db.manager, captured.id, nativeSchema);
    } catch {
      throw conflict();
    }
    return {
      ...captured,
      nativeSchema,
      semantics,
      columns: conditionColumns(nativeSchema, semantics),
    };
  }
  private stored(
    entry: SourceConditionEntry | null,
    columns: ReturnType<typeof conditionColumns>,
    semantics?: ConditionSemantics,
  ) {
    try {
      return compileConditionDefinition(
        entry ? JSON.parse(entry.definition) : { include: null, exclude: null },
        columns,
        semantics,
      ).definition;
    } catch {
      throw new ConflictException(
        '저장 조건을 현재 열에서 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.',
      );
    }
  }
  private response(
    state: Awaited<ReturnType<SourceConditionsService['snapshot']>>,
    semantics = state.semantics,
  ) {
    return {
      sourceId: state.id,
      sourceRevision: state.profile.dataVersion,
      version: state.entry?.version ?? 0,
      definition: this.stored(state.entry, state.columns, state.semantics),
      schemaChanged: !!state.entry && state.entry.sourceRevision !== state.profile.dataVersion,
      columns: conditionColumns(state.nativeSchema, semantics),
      ...(semantics === undefined ? {} : { semantics }),
    };
  }
  async read(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId', 'adoptCurrentSemantics', 'analysisConditions']);
    if (
      input.adoptCurrentSemantics !== undefined &&
      typeof input.adoptCurrentSemantics !== 'boolean'
    )
      throw new BadRequestException('업무 기준 채택 요청을 확인해 주세요.');
    if (input.analysisConditions !== undefined) return this.readAnalysis(input, actor);
    const state = await this.snapshot(input.sourceId, actor, 'read');
    const semantics = input.adoptCurrentSemantics
      ? await latestConditionSemantics(this.db.manager, state.id, state.nativeSchema)
      : state.semantics;
    await this.current(
      state.id,
      actor,
      state.profile.dataVersion,
      'read',
      state.entry?.version ?? 0,
    );
    if (input.adoptCurrentSemantics || !state.entry)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        semantics,
      );
    return this.response(state, semantics);
  }
  private async readAnalysis(input: Record<string, any>, actor: number) {
    let analysis;
    try {
      analysis = validateStudioConditions(input.analysisConditions);
    } catch {
      throw new BadRequestException('분석 조건의 기준을 확인해 주세요.');
    }
    const state = await this.snapshot(input.sourceId, actor, 'read', true);
    if (analysis.sourceRevision !== state.fileRevision) throw conflict();
    const frozen = await resolveConditionSemantics(
      this.db.manager,
      state.id,
      state.nativeSchema,
      analysis.semantics,
    );
    const definition = compileConditionDefinition(
      analysis.definition,
      conditionColumns(state.nativeSchema, frozen),
      frozen,
    ).definition;
    const semantics = input.adoptCurrentSemantics
      ? await latestConditionSemantics(this.db.manager, state.id, state.nativeSchema)
      : frozen;
    await this.current(state.id, actor, state.profile.dataVersion, 'read');
    await resolveConditionSemantics(this.db.manager, state.id, state.nativeSchema, frozen);
    if (input.adoptCurrentSemantics)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        semantics,
      );
    return {
      sourceId: state.id,
      sourceRevision: state.profile.dataVersion,
      version: state.entry?.version ?? 0,
      definition,
      columns: conditionColumns(state.nativeSchema, semantics),
      schemaChanged: !!state.entry && state.entry.sourceRevision !== state.profile.dataVersion,
      ...(semantics === undefined ? {} : { semantics }),
    };
  }
  private async prepare(body: unknown, actor: number, action: 'read' | 'edit') {
    const input = this.fields(body, [
      'sourceId',
      'sourceRevision',
      'version',
      'definition',
      'semantics',
    ]);
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
    this.stored(state.entry, state.columns, state.semantics);
    const semantics = await resolveConditionSemantics(
      this.db.manager,
      state.id,
      state.nativeSchema,
      input.semantics,
    );
    let usesLatest = !state.entry;
    if (JSON.stringify(semantics) !== JSON.stringify(state.semantics)) {
      if (semantics === undefined) throw conflict();
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        semantics,
      );
      usesLatest = true;
    }
    if (!state.entry)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        semantics,
      );
    const columns = conditionColumns(state.nativeSchema, semantics);
    const compiled = compileConditionDefinition(input.definition, columns, semantics);
    let dateFailure: unknown;
    try {
      await state.pin.run(() =>
        validateConditionBusinessDates(state.nativeSchema, semantics, (sql, bindings) =>
          this.connection.queryDuckDB(state.id, sql, bindings),
        ),
      );
    } catch (error) {
      dateFailure = error;
    }
    await this.current(
      state.id,
      actor,
      state.profile.dataVersion,
      action,
      state.entry?.version ?? 0,
    );
    await resolveConditionSemantics(this.db.manager, state.id, state.nativeSchema, semantics);
    if (usesLatest)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        semantics,
      );
    if (dateFailure) throw dateFailure;
    return {
      state: { ...state, columns, semantics },
      usesLatest,
      compiled,
      draft: {
        sourceId: state.id,
        sourceRevision: input.sourceRevision,
        version: input.version,
        definition: compiled.definition,
        ...(semantics === undefined ? {} : { semantics }),
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
    const { state, compiled, draft, usesLatest } = await this.prepare(body, actor, 'read');
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
      const analysisConditions = {
        sourceRevision: await this.connection.duckDBVersion(state.id),
        definition: compiled.definition,
        ...(state.semantics === undefined ? {} : { semantics: state.semantics }),
      };
      await this.current(state.id, actor, draft.sourceRevision, 'read', draft.version);
      return { draft, population, analysisConditions };
    });
    // A file replacement outside the pinned worker snapshot cannot make an old count current.
    await this.current(
      result.draft.sourceId,
      actor,
      result.draft.sourceRevision,
      'read',
      result.draft.version,
    );
    if (usesLatest)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        state.semantics,
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
      'semantics',
    ]);
    const { state, compiled, draft, usesLatest } = await this.prepare(
      {
        sourceId: input.sourceId,
        sourceRevision: input.sourceRevision,
        version: input.version,
        definition: input.definition,
        ...(input.semantics === undefined ? {} : { semantics: input.semantics }),
      },
      actor,
      'read',
    );
    const result = await state.pin.run(() =>
      sourceConditionProfile({
        schema: state.columns,
        columns: input.columns,
        definition: compiled.definition,
        semantics: state.semantics,
        query: (sql, bindings) => this.connection.queryDuckDB(state.id, sql, bindings),
      }),
    );
    await this.current(state.id, actor, draft.sourceRevision, 'read', draft.version);
    if (usesLatest)
      await assertLatestConditionSemantics(
        this.db.manager,
        state.id,
        state.nativeSchema,
        state.semantics,
      );
    return { draft, ...result };
  }
  async save(body: unknown, actor: number) {
    const { state, compiled, draft, usesLatest } = await this.prepare(body, actor, 'edit');
    await this.current(state.id, actor, draft.sourceRevision, 'edit');
    await metadataTransaction(this.db, async manager => {
      const sources = await lockMetricSources(manager, [state.id]);
      if (JSON.stringify(sources.get(state.id)) !== state.sourceBasis) throw conflict();
      await this.access.assert('database', state.id, actor, 'edit', manager);
      const latest = await manager
        .getRepository(SourceConditionEntry)
        .findOne({ where: { sourceId: state.id }, order: { version: 'DESC' } });
      if ((latest?.version ?? 0) !== draft.version) throw conflict();
      if (usesLatest)
        await assertLatestConditionSemantics(
          manager,
          state.id,
          state.nativeSchema,
          state.semantics,
        );
      await resolveConditionSemantics(manager, state.id, state.nativeSchema, state.semantics);
      try {
        await manager.getRepository(SourceConditionEntry).insert({
          sourceId: state.id,
          version: draft.version + 1,
          actorId: actor,
          sourceRevision: draft.sourceRevision,
          definition: JSON.stringify(compiled.definition),
          semanticsJSON: state.semantics === undefined ? null : JSON.stringify(state.semantics),
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          ((error.driverError as any)?.code === '23505' ||
            (error.driverError as any)?.code === 'ER_DUP_ENTRY' ||
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
      ...(state.semantics === undefined ? {} : { semantics: state.semantics }),
    };
  }
}
