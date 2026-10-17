import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';

type ColumnMetadata = { column: string; label: string; description: string; unit: string };
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
        })),
      };
    } catch {
      throw new ConflictException(
        '저장된 업무 설명 이력을 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.',
      );
    }
  }
  private async snapshot(sourceId: unknown, actor: number) {
    this.access.actor(actor);
    const id = this.access.id(sourceId);
    await this.access.assert('database', id, actor);
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
      : { label: profile.name, description: '', columns: [] };
    return { id, profile, schema, schemaRevision, entry, metadata };
  }
  async read(body: unknown, actor: number) {
    const input = this.fields(body, ['sourceId']);
    const { id, profile, schema, schemaRevision, entry, metadata } = await this.snapshot(
      input.sourceId,
      actor,
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
        ...metadata.columns.find(m => m.column === c.column),
      })),
    };
  }
  async save(body: unknown, actor: number) {
    const input = this.fields(body, [
      'sourceId',
      'sourceRevision',
      'version',
      'label',
      'description',
      'columns',
    ]);
    const { id, profile, schema, schemaRevision, entry } = await this.snapshot(
      input.sourceId,
      actor,
    );
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
      const c = this.fields(value, ['column', 'label', 'description', 'unit']);
      if (!schema.some(s => s.column === c.column) || names.has(c.column))
        throw new BadRequestException('열 이름은 실제 열과 일치해야 합니다.');
      names.add(c.column);
      const result = {
        column: c.column,
        label: this.text(c.label, 100, true),
        description: this.text(c.description, 1000),
        unit: this.text(c.unit, 24),
      };
      const key = result.label.normalize('NFKC').toLowerCase();
      if (labels.has(key)) throw new BadRequestException('열 표시명은 중복될 수 없습니다.');
      labels.add(key);
      return result;
    });
    const metadata = JSON.stringify({ label, description, columns });
    if (Buffer.byteLength(metadata, 'utf8') > 60000)
      throw new BadRequestException('업무 설명 전체 크기는 60KB 이하여야 합니다.');
    // UC050: unique (sourceId,version) is the cross-process compare-and-swap, not a local mutex.
    await this.access.assert('database', id, actor);
    const latest = await this.bi.profile(id, actor);
    if (!latest.supported || latest.dataVersion !== profile.dataVersion)
      throw new ConflictException('저장 중 데이터가 변경됐습니다. 최신 내용을 다시 확인해 주세요.');
    try {
      await this.db.getRepository(SourceCatalogEntry).insert({
        sourceId: id,
        version: input.version + 1,
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
    return {
      sourceId: id,
      sourceRevision: profile.dataVersion,
      version: input.version + 1,
      label,
      description,
      schemaChanged: false,
      columns: schema.map(c => ({ ...c, ...columns.find(m => m.column === c.column) })),
    };
  }
}
