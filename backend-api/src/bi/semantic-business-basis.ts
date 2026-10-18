import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { businessVariable, BusinessVariable } from './business-variable';
import { conditionDateExpression, projectConditionColumns } from './business-condition-semantics';
import { validateConditionBusinessDates } from './business-condition-context';

export type BusinessBasisColumn = BusinessVariable & {
  column: string;
  nativeType: string;
  label: string;
  description: string;
  unit: string;
};
export type BusinessBasis = {
  schemaVersion: 1;
  catalogVersion: number | null;
  schemaRevision: string;
  columns: BusinessBasisColumn[];
};
const invalid = () => new BadRequestException('생성할 지표·분류의 업무 기준을 확인해 주세요.');
const stale = () =>
  new ConflictException(
    '업무 기준 이력 또는 열 구조가 변경됐습니다. 기존 제안과 질문을 유지하고 다시 확인하세요.',
  );
function fields(value: any, allowed: string[], required = allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).some(
      key =>
        typeof key !== 'string' ||
        !allowed.includes(key) ||
        !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value'),
    ) ||
    required.some(key => !Object.prototype.hasOwnProperty.call(value, key))
  )
    throw invalid();
}
function text(value: unknown, max: number, empty = true): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) throw invalid();
  return value;
}
const ordered = <T extends { column: string }>(columns: T[]) =>
  [...columns].sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0));
const physical = (profile: any): Array<{ name: string; type: string }> => {
  if (!profile || !Array.isArray(profile.columns) || profile.columns.length > 2048) throw invalid();
  const columns = profile.columns.map(c => ({
    name: text(c?.name, 10000, false),
    type: text(c?.type, 10000, false),
  }));
  if (new Set(columns.map(c => c.name)).size !== columns.length) throw invalid();
  return columns;
};
export const businessSchemaRevision = (profile: any) =>
  createHash('sha256')
    .update(JSON.stringify(physical(profile).map(c => ({ column: c.name, type: c.type }))))
    .digest('hex');

/** Pure shape validation. Database consumers must additionally resolve the exact parent history. */
export function normalizeBusinessBasis(value: unknown): BusinessBasis {
  fields(value, ['schemaVersion', 'catalogVersion', 'schemaRevision', 'columns']);
  const input = value as any;
  if (
    input.schemaVersion !== 1 ||
    !(
      input.catalogVersion === null ||
      (Number.isSafeInteger(input.catalogVersion) &&
        input.catalogVersion > 0 &&
        input.catalogVersion <= 2147483647)
    ) ||
    typeof input.schemaRevision !== 'string' ||
    !/^[0-9a-f]{64}$/.test(input.schemaRevision) ||
    !Array.isArray(input.columns) ||
    input.columns.length > 2048
  )
    throw invalid();
  const columns: BusinessBasisColumn[] = input.columns.map(c => {
    const required = [
      'column',
      'nativeType',
      'label',
      'description',
      'unit',
      'businessType',
      'dateFormat',
      'classification',
    ];
    fields(c, [...required, 'classificationRef'], required);
    if (typeof c.businessType !== 'string' || typeof c.dateFormat !== 'string') throw invalid();
    const nativeType = text(c.nativeType, 10000, false);
    return {
      column: text(c.column, 10000, false),
      nativeType,
      label: text(c.label, 100, false),
      description: text(c.description, 1000),
      unit: text(c.unit, 24),
      ...businessVariable(c, undefined, nativeType),
    };
  });
  if (new Set(columns.map(c => c.column)).size !== columns.length) throw invalid();
  const result: BusinessBasis = {
    schemaVersion: 1,
    catalogVersion: input.catalogVersion,
    schemaRevision: input.schemaRevision,
    columns: ordered(columns),
  };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 128 * 1024) throw invalid();
  return result;
}
function nativeBasis(profile: any): BusinessBasis {
  return normalizeBusinessBasis({
    schemaVersion: 1,
    catalogVersion: null,
    schemaRevision: businessSchemaRevision(profile),
    columns: physical(profile).map(c => ({
      column: c.name,
      nativeType: c.type,
      label: c.name,
      description: '',
      unit: '',
      ...businessVariable({}),
    })),
  });
}
function fromEntry(profile: any, entry: SourceCatalogEntry): BusinessBasis {
  try {
    if (
      entry.schemaRevision !== businessSchemaRevision(profile) ||
      !Number.isSafeInteger(entry.version) ||
      entry.version < 1
    )
      throw stale();
    const metadata = JSON.parse(entry.metadata),
      schema = physical(profile);
    if (
      !metadata ||
      typeof metadata.label !== 'string' ||
      typeof metadata.description !== 'string' ||
      !Array.isArray(metadata.columns) ||
      metadata.columns.length !== schema.length ||
      new Set(metadata.columns.map(c => c?.column)).size !== schema.length
    )
      throw stale();
    const columns = metadata.columns.map(c => {
      const native = schema.find(n => n.name === c?.column);
      if (!native) throw stale();
      return {
        column: c.column,
        nativeType: native.type,
        label: c.label,
        description: c.description,
        unit: c.unit,
        ...businessVariable(c, undefined, native.type),
      };
    });
    return normalizeBusinessBasis({
      schemaVersion: 1,
      catalogVersion: entry.version,
      schemaRevision: entry.schemaRevision,
      columns,
    });
  } catch {
    throw stale();
  }
}
export function sliceBusinessBasis(
  basis: BusinessBasis | undefined,
  names: string[],
): BusinessBasis | undefined {
  if (!basis) return undefined;
  const value = normalizeBusinessBasis(basis),
    wanted = [...new Set(names.filter(n => n !== '*'))];
  if (wanted.some(n => !value.columns.some(c => c.column === n))) throw invalid();
  return { ...value, columns: value.columns.filter(c => wanted.includes(c.column)) };
}
/** No catalog means legacy native. This helper is metadata-only, never an authority check. */
export async function captureBusinessBasis(
  manager: EntityManager,
  sourceId: number,
  profile: any,
): Promise<BusinessBasis | undefined> {
  return serializeMetadataWork(manager.connection, async () => {
    const entry = await manager.findOne(SourceCatalogEntry, {
      where: { sourceId },
      order: { version: 'DESC' },
    });
    return entry ? fromEntry(profile, entry) : undefined;
  });
}
export async function resolveBusinessBasis(
  manager: EntityManager,
  sourceId: number,
  profile: any,
  supplied: unknown,
  requiredColumns: string[] = [],
): Promise<BusinessBasis | undefined> {
  if (supplied === undefined) return undefined;
  let value: BusinessBasis;
  try {
    value = normalizeBusinessBasis(supplied);
  } catch {
    throw stale();
  }
  return serializeMetadataWork(manager.connection, async () => {
    const entry =
      value.catalogVersion === null
        ? undefined
        : await manager.findOneBy(SourceCatalogEntry, { sourceId, version: value.catalogVersion });
    if (value.catalogVersion !== null && !entry) throw stale();
    const canonical = entry ? fromEntry(profile, entry) : nativeBasis(profile);
    if (requiredColumns.filter(n => n !== '*').some(n => !value.columns.some(c => c.column === n)))
      throw stale();
    let expected: BusinessBasis;
    try {
      expected = sliceBusinessBasis(
        canonical,
        value.columns.map(c => c.column),
      );
    } catch {
      throw stale();
    }
    if (JSON.stringify(expected) !== JSON.stringify(value)) throw stale();
    return value;
  });
}
/** Used only for a newly captured context/adoption; historical proposals use resolve instead. */
export async function assertBusinessBasisCurrent(
  manager: EntityManager,
  sourceId: number,
  profile: any,
  captured: BusinessBasis | undefined,
) {
  const latest = await captureBusinessBasis(manager, sourceId, profile);
  const expected = captured
    ? sliceBusinessBasis(
        latest,
        captured.columns.map(c => c.column),
      )
    : latest;
  if (JSON.stringify(expected) !== JSON.stringify(captured)) throw stale();
}

/** An ephemeral new-creation projection. Never replace the native profile for old definitions. */
export function businessProfile(profile: any, supplied?: BusinessBasis) {
  if (!supplied) return profile;
  const basis = normalizeBusinessBasis(supplied),
    schema = physical(profile);
  if (basis.schemaRevision !== businessSchemaRevision(profile)) throw stale();
  for (const column of basis.columns)
    if (!schema.some(c => c.name === column.column && c.type === column.nativeType)) throw stale();
  return {
    ...profile,
    businessBasis: basis,
    columns: profile.columns.map(c => {
      const declaration = basis.columns.find(d => d.column === c.name);
      if (!declaration) return { ...c };
      const numeric =
        declaration.businessType === 'auto' ? !!c.numeric : declaration.businessType === 'number';
      const temporal =
        declaration.businessType === 'auto' ? !!c.temporal : declaration.businessType === 'date';
      return {
        ...c,
        label: declaration.label,
        description: declaration.description,
        unit: declaration.unit,
        businessType: declaration.businessType,
        dateFormat: declaration.dateFormat,
        classification: declaration.classification,
        ...(declaration.classificationRef === undefined
          ? {}
          : { classificationRef: declaration.classificationRef }),
        nativeNumeric: !!c.numeric,
        nativeTemporal: !!c.temporal,
        numeric,
        temporal,
        dimension: declaration.businessType === 'category' || temporal || !numeric,
      };
    }),
  };
}
export function businessDimensionExpression(
  profile: any,
  supplied: BusinessBasis | undefined,
  column: string,
): string {
  const native = physical(profile).find(c => c.name === column);
  if (!native) throw invalid();
  const basis = supplied ? normalizeBusinessBasis(supplied) : undefined;
  if (basis) businessProfile(profile, basis);
  const declaration = basis?.columns.find(c => c.column === column);
  if (declaration?.businessType === 'date') {
    const projected = projectConditionColumns([{ name: column, type: native.type }], {
      schemaVersion: 1,
      catalogVersion: basis.catalogVersion ?? 1,
      columns: [{ column, businessType: 'date', dateFormat: declaration.dateFormat }],
    });
    return conditionDateExpression(projected[0]);
  }
  return `"${column.replace(/"/g, '""')}"`;
}
/** Stable execution identity excludes display metadata and unused declarations. */
export function businessExecutionIdentity(supplied: BusinessBasis | undefined, names: string[]) {
  const basis = sliceBusinessBasis(supplied, names);
  const execution = basis?.columns
    .filter(c => c.businessType !== 'auto')
    .map(c => ({
      column: c.column,
      nativeType: c.nativeType,
      businessType: c.businessType,
      dateFormat: c.dateFormat,
    }));
  return execution?.length ? execution : undefined;
}
export function businessDateExpressions(
  supplied: BusinessBasis | undefined,
): Array<{ column: string; expression: string }> {
  if (!supplied) return [];
  const basis = normalizeBusinessBasis(supplied);
  // The full schema hash is intentionally not compared here: persisted basis may cover only used columns.
  return basis.columns
    .filter(c => c.businessType === 'date')
    .map(c => {
      const projected = projectConditionColumns([{ name: c.column, type: c.nativeType }], {
        schemaVersion: 1,
        catalogVersion: basis.catalogVersion ?? 1,
        columns: [{ column: c.column, businessType: 'date', dateFormat: c.dateFormat }],
      });
      return { column: c.column, expression: conditionDateExpression(projected[0]) };
    });
}
/** Masks only exact fixed server expressions; callers still apply the unchanged SELECT grammar. */
export function maskBusinessDateExpressions(sql: string, supplied?: BusinessBasis): string {
  const expressions = businessDateExpressions(supplied).sort(
    (a, b) => b.expression.length - a.expression.length,
  );
  let result = '',
    offset = 0;
  while (offset < sql.length) {
    const quote = sql[offset];
    if (quote === "'" || quote === '"') {
      const start = offset++;
      while (offset < sql.length) {
        if (sql[offset++] !== quote) continue;
        if (sql[offset] === quote) {
          offset++;
          continue;
        }
        break;
      }
      result += sql.slice(start, offset);
      continue;
    }
    const match =
      (offset === 0 || !/[A-Za-z0-9_.$:"]/.test(sql[offset - 1])) &&
      expressions.find(value => sql.startsWith(value.expression, offset));
    if (match) {
      result += `"${match.column.replace(/"/g, '""')}"`;
      offset += match.expression.length;
    } else result += sql[offset++];
  }
  return result;
}
export async function validateBasisBusinessDates(
  profile: any,
  supplied: BusinessBasis | undefined,
  query: (sql: string, bindings?: unknown[]) => Promise<{ datas: any[] }>,
) {
  if (!supplied) return;
  const basis = normalizeBusinessBasis(supplied);
  businessProfile(profile, basis);
  const columns = basis.columns
    .filter(c => c.businessType !== 'auto')
    .map(c => ({
      column: c.column,
      businessType: c.businessType as 'number' | 'category' | 'date',
      dateFormat: c.dateFormat,
    }));
  if (columns.length)
    await validateConditionBusinessDates(
      physical(profile),
      { schemaVersion: 1, catalogVersion: basis.catalogVersion ?? 1, columns },
      query,
    );
}
