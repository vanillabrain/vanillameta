import { governedScalar, ViewCatalog, ViewFilter } from './governanceApi';
export const fixedFilters = (filters: ViewFilter[]) =>
  JSON.stringify(
    [...filters]
      .map(f => ({
        column: f.column,
        values: [...f.values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      }))
      .sort((a, b) => a.column.localeCompare(b.column)),
  );
export function readFrameState(search: string) {
  if (!search) return { embedded: false, theme: 'light' as const, filters: [] as ViewFilter[], key: '' };
  const params = new URLSearchParams(search);
  if (
    search.length > 8192 ||
    Array.from(params.keys()).some(k => !['embed', 'theme', 'filters'].includes(k)) ||
    ['embed', 'theme', 'filters'].some(k => params.getAll(k).length > 1) ||
    params.get('embed') !== '1' ||
    (params.has('theme') && !['light', 'dark'].includes(params.get('theme') || ''))
  )
    throw new Error('지원하는 임베드 상태를 확인해 주세요.');
  const filters = params.has('filters') ? JSON.parse(params.get('filters') || '[]') : [];
  if (
    !Array.isArray(filters) ||
    filters.length > 4 ||
    new Set(filters.map(f => f?.column)).size !== filters.length ||
    !filters.every(
      f =>
        f &&
        Object.keys(f).length === 2 &&
        Object.keys(f).every(k => ['column', 'values'].includes(k)) &&
        typeof f.column === 'string' &&
        f.column.length <= 128 &&
        Array.isArray(f.values) &&
        f.values.length > 0 &&
        f.values.length <= 20 &&
        f.values.every(v => governedScalar(v) && (typeof v !== 'string' || v.length <= 256)),
    )
  )
    throw new Error('임베드 필터를 확인해 주세요.');
  const key = fixedFilters(filters);
  return {
    embedded: true,
    theme: (params.get('theme') || 'light') as 'light' | 'dark',
    filters: JSON.parse(key) as ViewFilter[],
    key,
  };
}
export function frameFilters(filters: ViewFilter[], catalog: ViewCatalog) {
  if (!filters.every(f => catalog.columns.some(c => c.name === f.column)))
    throw new Error('허용된 필터만 연결할 수 있습니다.');
  return filters;
}
/** Trusted first-party application only. This is not a sandbox for untrusted same-origin code. */
export function trustedFrameParent() {
  try {
    let current: Window = window;
    while (current !== current.parent) {
      if (current.parent.location.origin !== location.origin) return false;
      current = current.parent;
    }
    return true;
  } catch {
    return false;
  }
}
