import { post } from '@/helpers/apiHelper';
import { validClassificationRef, ClassificationRef } from './classificationService';
export type BusinessBasisColumn = {
  column: string;
  nativeType: string;
  label: string;
  description: string;
  unit: string;
  businessType: 'auto' | 'number' | 'category' | 'date';
  dateFormat: '' | 'native' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYYMMDD';
  classification: string;
  classificationRef?: ClassificationRef | null;
};
export type BusinessBasis = {
  schemaVersion: 1;
  catalogVersion: number | null;
  schemaRevision: string;
  columns: BusinessBasisColumn[];
};
export type BusinessColumn = {
  name: string;
  type: string;
  numeric: boolean;
  temporal: boolean;
  label?: string;
  description?: string;
  unit?: string;
  businessType?: BusinessBasisColumn['businessType'];
  dateFormat?: BusinessBasisColumn['dateFormat'];
  [key: string]: unknown;
};
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: any, keys: string[], optional: string[] = []) =>
  object(v) &&
  keys.every(k => Object.prototype.hasOwnProperty.call(v, k)) &&
  Object.keys(v).every(k => keys.includes(k) || optional.includes(k));
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validBusinessBasis(v: any): v is BusinessBasis | null {
  return (
    v === null ||
    (exact(v, ['schemaVersion', 'catalogVersion', 'schemaRevision', 'columns']) &&
      v.schemaVersion === 1 &&
      (v.catalogVersion === null ||
        (Number.isSafeInteger(v.catalogVersion) && v.catalogVersion > 0 && v.catalogVersion <= 2147483647)) &&
      hash(v.schemaRevision) &&
      Array.isArray(v.columns) &&
      v.columns.length <= 2048 &&
      new TextEncoder().encode(JSON.stringify(v)).length <= 128 * 1024 &&
      new Set(v.columns.map(c => c?.column)).size === v.columns.length &&
      v.columns.every(
        c =>
          exact(
            c,
            ['column', 'nativeType', 'label', 'description', 'unit', 'businessType', 'dateFormat', 'classification'],
            ['classificationRef'],
          ) &&
          ['column', 'nativeType'].every(k => typeof c[k] === 'string' && c[k].length > 0 && c[k].length <= 10000) &&
          ['label', 'description', 'unit', 'classification'].every(k => typeof c[k] === 'string') &&
          c.label.length > 0 &&
          c.label.length <= 100 &&
          c.description.length <= 1000 &&
          c.unit.length <= 24 &&
          c.classification.length <= 80 &&
          ['auto', 'number', 'category', 'date'].includes(c.businessType) &&
          ['', 'native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(c.dateFormat) &&
          (c.businessType === 'date') === (c.dateFormat !== '') &&
          (c.classificationRef == null || validClassificationRef(c.classificationRef)),
      ))
  );
}
export function assertOptionalBusinessBasis(v: any) {
  if (object(v) && Object.prototype.hasOwnProperty.call(v, 'businessBasis') && !validBusinessBasis(v.businessBasis))
    throw new Error('업무 기준을 확인하지 못했습니다.');
}
export type BusinessBasisResult = {
  sourceId: number;
  sourceRevision: string;
  businessBasis: BusinessBasis | null;
  businessColumns: BusinessColumn[];
};
export function readBusinessBasis(response: any, sourceId: number): BusinessBasisResult {
  const v = response?.data?.status === 'SUCCESS' ? response.data.data : null;
  if (
    !exact(v, ['sourceId', 'sourceRevision', 'businessBasis', 'businessColumns']) ||
    v.sourceId !== sourceId ||
    !hash(v.sourceRevision) ||
    !validBusinessBasis(v.businessBasis) ||
    !Array.isArray(v.businessColumns) ||
    new Set(v.businessColumns.map(c => c?.name)).size !== v.businessColumns.length ||
    !v.businessColumns.every(
      c =>
        exact(
          c,
          [
            'name',
            'type',
            'numeric',
            'temporal',
            'label',
            'description',
            'unit',
            'businessType',
            'dateFormat',
            'classification',
          ],
          ['classificationRef'],
        ) &&
        typeof c.name === 'string' &&
        !!c.name &&
        typeof c.type === 'string' &&
        typeof c.numeric === 'boolean' &&
        typeof c.temporal === 'boolean' &&
        ['label', 'description', 'unit', 'classification'].every(k => typeof c[k] === 'string') &&
        ['auto', 'number', 'category', 'date'].includes(c.businessType) &&
        ['', 'native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(c.dateFormat) &&
        (c.businessType === 'date') === (c.dateFormat !== '') &&
        (c.classificationRef == null || validClassificationRef(c.classificationRef)),
    )
  )
    throw new Error('업무 기준을 확인하지 못했습니다. 기존 입력을 유지합니다.');
  return v;
}
export async function fetchBusinessBasis(sourceId: number, signal?: AbortSignal) {
  return readBusinessBasis(await post('/bi/business-basis', { sourceId }, { signal }), sourceId);
}
export const businessColumnLabel = (c: BusinessColumn) =>
  `${c.label && c.label !== c.name ? `${c.label} · ` : ''}${c.name} · ${c.type}${c.unit ? ` · ${c.unit}` : ''}`;
/** Keep explicit no-time distinct from legacy automatic selection. */
export function assertDefaultDateColumn(value: any, kind: unknown) {
  assertOptionalBusinessBasis(value);
  if (!object(value) || value.defaultDateColumn === undefined) return;
  if (kind !== 'BOARD_NUMERIC' || !value.businessBasis || !validBusinessBasis(value.businessBasis))
    throw new Error('기본 추세 날짜는 업무 기준이 있는 숫자 블록에서만 사용할 수 있습니다.');
  if (
    value.defaultDateColumn !== null &&
    (typeof value.defaultDateColumn !== 'string' || !value.defaultDateColumn.trim() || value.defaultDateColumn.length > 255)
  )
    throw new Error('기본 추세 날짜 열을 확인해 주세요.');
}
