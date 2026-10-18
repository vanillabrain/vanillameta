import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { businessVariable, DATE_FORMATS } from './business-variable';
import {
  ConditionSemantics,
  projectConditionColumns,
  validateConditionSemantics,
} from './business-condition-semantics';

type Schema = Array<{ name: string; type: string }>;
type Query = (sql: string, bindings?: unknown[]) => Promise<{ datas: any[] }>;
const conflict = () =>
  new ConflictException(
    '조건의 업무 기준 이력을 확인할 수 없습니다. 입력을 유지하고 다시 확인해 주세요.',
  );

function canonical(entry: SourceCatalogEntry, schema: Schema): ConditionSemantics {
  try {
    projectConditionColumns(schema);
    const revision = createHash('sha256')
      .update(JSON.stringify(schema.map(c => ({ column: c.name, type: c.type }))))
      .digest('hex');
    if (entry.schemaRevision !== revision) throw conflict();
    const metadata = JSON.parse(entry.metadata);
    if (
      !metadata ||
      typeof metadata.label !== 'string' ||
      typeof metadata.description !== 'string' ||
      !Array.isArray(metadata.columns) ||
      metadata.columns.length !== schema.length ||
      new Set(metadata.columns.map(c => c?.column)).size !== schema.length
    )
      throw conflict();
    const columns: ConditionSemantics['columns'] = [];
    for (const column of metadata.columns) {
      if (
        !column ||
        ['column', 'label', 'description', 'unit'].some(key => typeof column[key] !== 'string')
      )
        throw conflict();
      const native = schema.find(c => c.name === column.column);
      if (!native) throw conflict();
      const declaration = businessVariable(column, undefined, native.type);
      if (declaration.businessType !== 'auto')
        columns.push({
          column: column.column,
          businessType: declaration.businessType,
          dateFormat: declaration.dateFormat,
        });
    }
    const snapshot = validateConditionSemantics({
      schemaVersion: 1,
      catalogVersion: entry.version,
      columns,
    });
    projectConditionColumns(schema, snapshot);
    return snapshot;
  } catch {
    throw conflict();
  }
}

/** Metadata only. Undefined explicitly preserves native legacy meaning; never reads latest implicitly. */
export async function resolveConditionSemantics(
  manager: EntityManager,
  sourceId: number,
  schema: Schema,
  snapshot: unknown,
): Promise<ConditionSemantics | undefined> {
  if (snapshot === undefined) return undefined;
  const supplied = validateConditionSemantics(snapshot);
  const entry = await serializeMetadataWork(manager.connection, () =>
    manager.findOneBy(SourceCatalogEntry, { sourceId, version: supplied.catalogVersion }),
  );
  if (!entry) throw conflict();
  const expected = canonical(entry, schema);
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) throw conflict();
  return expected;
}

/** Metadata only. Entire non-auto canonical catalog declaration, including unreferenced columns. */
export async function latestConditionSemantics(
  manager: EntityManager,
  sourceId: number,
  schema: Schema,
): Promise<ConditionSemantics | undefined> {
  const entry = await serializeMetadataWork(manager.connection, () =>
    manager.findOne(SourceCatalogEntry, { where: { sourceId }, order: { version: 'DESC' } }),
  );
  return entry ? canonical(entry, schema) : undefined;
}

export async function assertLatestConditionSemantics(
  manager: EntityManager,
  sourceId: number,
  schema: Schema,
  captured: ConditionSemantics | undefined,
): Promise<void> {
  const latest = await latestConditionSemantics(manager, sourceId, schema);
  if (
    JSON.stringify(latest) !==
    JSON.stringify(captured === undefined ? undefined : validateConditionSemantics(captured))
  )
    throw conflict();
}

/** Caller owns current read checks and immutable pin before/after this full scan, outside metadata queues. */
export async function validateConditionBusinessDates(
  schema: Schema,
  snapshot: ConditionSemantics | undefined,
  query: Query,
): Promise<void> {
  const columns = projectConditionColumns(schema, snapshot).filter(
    c => c.businessType === 'date' && c.dateFormat !== 'native',
  );
  if (!columns.length) return;
  const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
  const expressions = columns.map((column, index) => {
    const raw = quote(column.name),
      format = DATE_FORMATS[column.dateFormat];
    const pattern =
      column.dateFormat === 'YYYYMMDD'
        ? '[0-9]{8}'
        : column.dateFormat === 'YYYY/MM/DD'
        ? '[0-9]{4}/[0-9]{2}/[0-9]{2}'
        : '[0-9]{4}-[0-9]{2}-[0-9]{2}';
    const parsed = `try_strptime(${raw}, '${format}')`;
    return `COUNT(*) FILTER (WHERE ${raw} IS NOT NULL AND (NOT regexp_full_match(${raw}, '${pattern}') OR substr(${raw}, 1, 4) = '0000' OR ${parsed} IS NULL OR strftime(${parsed}, '${format}') <> ${raw})) AS invalid_${index}, COUNT(*) FILTER (WHERE ${raw} IS NOT NULL AND trim(${raw}) = '') AS blank_${index}`;
  });
  const result = (await query(`SELECT ${expressions.join(', ')} FROM uploaded_data`, []))
    .datas?.[0];
  const details = columns.map((column, index) => {
    const invalidCount = String(result?.[`invalid_${index}`]),
      blankCount = String(result?.[`blank_${index}`]);
    if (
      !/^\d{1,20}$/.test(invalidCount) ||
      !/^\d{1,20}$/.test(blankCount) ||
      BigInt(blankCount) > BigInt(invalidCount)
    )
      throw conflict();
    return { column: column.name, invalidCount, blankCount };
  });
  if (details.some(c => c.invalidCount !== '0'))
    throw new BadRequestException({
      code: 'INVALID_BUSINESS_DATES',
      message: '업무 날짜 형식과 맞지 않는 값이 있습니다. 현재 입력을 유지해 주세요.',
      details,
    });
}
