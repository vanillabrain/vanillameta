import { businessVariable, BusinessVariable } from './business-variable';
import { metadataTransaction } from '../common/metadata-work';
import { lockMetricSources } from '../metric/metric-write-lock';
import { Database } from '../database/entities/database.entity';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, LessThan, QueryFailedError } from 'typeorm';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';

type ColumnMetadata = {
  column: string;
  label: string;
  description: string;
  unit: string;
} & BusinessVariable;
@Injectable()
export class SourceCatalogService {
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly bi: BiService,
  ) {}
  private fields(input: any, allowed: string[]) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key))
    )
      throw new BadRequestException('업무 설명 요청을 확인해 주세요.');
    return input;
  }
  private text(value: unknown, max: number, required = false): string {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
      throw new BadRequestException('표시명·설명·단위의 길이를 확인해 주세요.');
    return value.trim();
  }
  private storedMetadata(entry: SourceCatalogEntry) {
    try {
      const value = JSON.parse(entry.metadata);
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.label !== 'string' ||
        typeof value.description !== 'string' ||
        !Array.isArray(value.columns) ||
        value.columns.some(
          c =>
            !c ||
            typeof c !== 'object' ||
            ['column', 'label', 'description', 'unit'].some(key => typeof c[key] !== 'string'),
        )
      )
        throw new Error('invalid metadata');
      return {
        label: value.label,
        description: value.description,
        columns: value.columns.map(c => ({
          column: c.column,
          label: c.label,
          description: c.description,
          unit: c.unit,
          ...businessVariable(c),
        })),
      };
    } catch {
      throw new ConflictException(
        '저장된 업무 설명 이력을 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.',
      );
    }
  }
  /**
   * UC051: the same stored-metadata snapshot serves read and edit callers, so the required
   * source action is passed in instead of hard-coding owner-only access.
   */
  private async snapshot(sourceId: unknown, actor: number, action: 'read' | 'edit') {
    this.access.actor(actor);
    const id = this.access.id(sourceId);
    await this.access.assert('database', id, actor, action);
    const profile = await this.bi.profile(id, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 소스를 선택해 주세요.');
    const schema = profile.columns.map(c => ({ column: c.name, type: c.type }));
    const schemaRevision = createHash('sha256').update(JSON.stringify(schema)).digest('hex');
    const entry = await this.db
      .getRepository(SourceCatalogEntry)
      .findOne({ where: { sourceId: id }, order: { version: 'DESC' } });
    const metadata = entry
      ? this.storedMetadata(entry)
      : {
          label: profile.name,
          description: '',
          columns: schema.map(c => ({
            column: c.column,
            label: c.column,
            description: '',
            unit: '',
            ...businessVariable({}),
          })),
        };
    if (entry && entry.schemaRevision === schemaRevision) {
      try {
        if (
          metadata.columns.length !== schema.length ||
          new Set(metadata.columns.map(c => c.column)).size !== schema.length
        )
          throw new Error('invalid stored columns');
        for (const column of metadata.columns) {
          const actual = schema.find(c => c.column === column.column);
          if (!actual) throw new Error('missing stored column');
          businessVariable(column, undefined, actual.type);
        }
      } catch {
        throw new ConflictException(
          '저장된 업무 유형이 현재 열과 맞지 않습니다. 데이터 담당자의 확인이 필요합니다.',
        );
      }
    }
    return { id, profile, schema, schemaRevision, entry, metadata };
  }
  async read(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId']);
    const { id, profile, schema, schemaRevision, entry, metadata } = await this.snapshot(
      input.sourceId,
      actor,
      'read',
    );
    return {
      sourceId: id,
      sourceRevision: profile.dataVersion,
      version: entry?.version ?? 0,
      label: metadata.label,
      description: metadata.description,
      schemaChanged: !!entry && entry.schemaRevision !== schemaRevision,
      columns: schema.map(c => ({
        ...c,
        label: c.column,
        description: '',
        unit: '',
        ...businessVariable({}),
        ...metadata.columns.find(m => m.column === c.column),
      })),
    };
  }
  private version(value: unknown): number {
    if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 2147483647)
      throw new BadRequestException('저장 버전을 확인해 주세요.');
    return Number(value);
  }
  private async historySource(sourceId: unknown, actor: number) {
    this.access.actor(actor);
    const id = this.access.id(sourceId);
    await this.access.assert('database', id, actor, 'read');
    return id;
  }
  async history(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId', 'beforeVersion']);
    const before =
      input.beforeVersion === undefined ? undefined : this.version(input.beforeVersion);
    const sourceId = await this.historySource(input.sourceId, actor);
    const rows = await this.db.getRepository(SourceCatalogEntry).find({
      where: { sourceId, ...(before === undefined ? {} : { version: LessThan(before) }) },
      order: { version: 'DESC' },
      take: 21,
    });
    const page = rows.slice(0, 20);
    return {
      sourceId,
      entries: page.map(row => {
        let label: string | null = null;
        try {
          label = this.storedMetadata(row).label;
        } catch {
          /* A damaged entry must not hide healthy history. */
        }
        return {
          version: row.version,
          createdAt: row.createdAt,
          label,
          unreadable: label === null,
        };
      }),
      nextBeforeVersion: rows.length > 20 ? page[page.length - 1].version : null,
    };
  }
  private changes(
    left: { label: string; description: string; columns: ColumnMetadata[] },
    right: { label: string; description: string; columns: ColumnMetadata[] },
  ) {
    const changes: Array<{
      column: string | null;
      field: string;
      before: string | null;
      after: string | null;
    }> = [];
    const add = (column: string | null, field: string, a: string | null, b: string | null) => {
      if (a !== b) changes.push({ column, field, before: a, after: b });
    };
    for (const field of ['label', 'description']) add(null, field, left[field], right[field]);
    const oldColumns = new Map<string, ColumnMetadata>(left.columns.map(c => [c.column, c]));
    const newColumns = new Map<string, ColumnMetadata>(right.columns.map(c => [c.column, c]));
    for (const column of new Set([...oldColumns.keys(), ...newColumns.keys()])) {
      for (const field of [
        'label',
        'description',
        'unit',
        'businessType',
        'dateFormat',
        'classification',
      ])
        add(
          column,
          field,
          oldColumns.get(column)?.[field] ?? null,
          newColumns.get(column)?.[field] ?? null,
        );
    }
    return changes;
  }
  async compare(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId', 'fromVersion', 'toVersion']);
    const fromVersion = this.version(input.fromVersion),
      toVersion = this.version(input.toVersion);
    if (fromVersion >= toVersion)
      throw new BadRequestException('이전 버전과 이후 버전을 순서대로 선택해 주세요.');
    const sourceId = await this.historySource(input.sourceId, actor);
    const repo = this.db.getRepository(SourceCatalogEntry);
    const [before, after] = await Promise.all([
      repo.findOneBy({ sourceId, version: fromVersion }),
      repo.findOneBy({ sourceId, version: toVersion }),
    ]);
    if (!before || !after) throw new NotFoundException('선택한 저장 버전이 없습니다.');
    const left = this.storedMetadata(before),
      right = this.storedMetadata(after);
    const changes = this.changes(left, right);
    return {
      sourceId,
      fromVersion,
      toVersion,
      schemaChanged: before.schemaRevision !== after.schemaRevision,
      dataChanged: before.sourceRevision !== after.sourceRevision,
      changes,
    };
  }
  private async prepare(body: unknown, actor: number) {
    const input = this.fields(body, [
      'sourceId',
      'sourceRevision',
      'version',
      'label',
      'description',
      'columns',
    ]);
    const {
      id,
      profile,
      schema,
      schemaRevision,
      entry,
      metadata: previousMetadata,
    } = await this.snapshot(input.sourceId, actor, 'edit');
    if (!Number.isSafeInteger(input.version) || input.version < 0 || input.version >= 2147483647)
      throw new BadRequestException('업무 설명 버전을 확인해 주세요.');
    if (typeof input.sourceRevision !== 'string' || !input.sourceRevision)
      throw new BadRequestException('데이터 버전을 확인해 주세요.');
    if (
      input.sourceRevision !== profile.dataVersion ||
      input.version !== (entry?.version ?? 0) ||
      (entry && entry.schemaRevision !== schemaRevision)
    )
      throw new ConflictException(
        '데이터 또는 업무 설명이 변경됐습니다. 최신 내용을 다시 확인해 주세요.',
      );
    const label = this.text(input.label, 100, true);
    const description = this.text(input.description, 1000);
    if (!Array.isArray(input.columns) || input.columns.length !== schema.length)
      throw new BadRequestException('실제 열 목록과 일치해야 합니다.');
    const names = new Set<string>(),
      labels = new Set<string>();
    const columns: ColumnMetadata[] = input.columns.map(value => {
      const c = this.fields(value, [
        'column',
        'label',
        'description',
        'unit',
        'businessType',
        'dateFormat',
        'classification',
      ]);
      if (!schema.some(s => s.column === c.column) || names.has(c.column))
        throw new BadRequestException('열 이름은 실제 열과 일치해야 합니다.');
      names.add(c.column);
      const result = {
        column: c.column,
        label: this.text(c.label, 100, true),
        description: this.text(c.description, 1000),
        unit: this.text(c.unit, 24),
        ...businessVariable(
          c,
          previousMetadata.columns.find(m => m.column === c.column),
          schema.find(s => s.column === c.column).type,
        ),
      };
      const key = result.label.normalize('NFKC').toLowerCase();
      if (labels.has(key)) throw new BadRequestException('열 표시명은 중복될 수 없습니다.');
      labels.add(key);
      return result;
    });
    const metadata = JSON.stringify({ label, description, columns });
    if (Buffer.byteLength(metadata, 'utf8') > 60000)
      throw new BadRequestException('업무 설명 전체 크기는 60KB 이하여야 합니다.');
    const dates = columns.filter(c => c.businessType === 'date' && c.dateFormat !== 'native');
    if (dates.length) await this.bi.validateBusinessDates(id, actor, profile.dataVersion, dates);
    return {
      id,
      profile,
      schema,
      schemaRevision,
      entry,
      columns,
      label,
      description,
      metadata,
      version: input.version,
      previousMetadata,
    };
  }
  async preview(body: unknown, actor: number) {
    const prepared = await this.prepare(body, actor);
    const { id, profile, columns, label, description, version, previousMetadata } = prepared;
    return {
      draft: {
        sourceId: id,
        sourceRevision: profile.dataVersion,
        version,
        label,
        description,
        columns,
      },
      changes: this.changes(previousMetadata, { label, description, columns }),
    };
  }
  async save(body: unknown, actor: number) {
    const { id, profile, schema, schemaRevision, columns, label, description, metadata, version } =
      await this.prepare(body, actor);
    // Profile/schema validation can query the source; finish it before acquiring metadata locks.
    const basis = await this.db.getRepository(Database).findOne({ where: { id } });
    const latest = await this.bi.profile(id, actor);
    if (!latest.supported || latest.dataVersion !== profile.dataVersion)
      throw new ConflictException('저장 중 데이터가 변경됐습니다. 최신 내용을 다시 확인해 주세요.');
    await metadataTransaction(this.db, async manager => {
      const sources = await lockMetricSources(manager, [id]);
      if (JSON.stringify(sources.get(id)) !== JSON.stringify(basis))
        throw new ConflictException(
          '저장 중 데이터가 변경됐습니다. 최신 내용을 다시 확인해 주세요.',
        );
      await this.access.assert('database', id, actor, 'edit', manager);
      // The immutable file revision above pins prepare()'s date validation result. Recheck
      // authority/version here without repeating a full scan while holding the SQLite write queue.
      try {
        await manager.getRepository(SourceCatalogEntry).insert({
          sourceId: id,
          version: version + 1,
          actorId: actor,
          schemaRevision,
          sourceRevision: profile.dataVersion,
          metadata,
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          ((error.driverError as any)?.code === 'ER_DUP_ENTRY' ||
            ((error.driverError as any)?.code === 'SQLITE_CONSTRAINT' &&
              /UNIQUE constraint failed: source_catalog_entry/.test(error.message)))
        )
          throw new ConflictException(
            '다른 창에서 먼저 저장했습니다. 최신 내용을 다시 확인해 주세요.',
          );
        throw error;
      }
    });
    return {
      sourceId: id,
      sourceRevision: profile.dataVersion,
      version: version + 1,
      label,
      description,
      schemaChanged: false,
      columns: schema.map(c => ({ ...c, ...columns.find(m => m.column === c.column) })),
    };
  }
}
