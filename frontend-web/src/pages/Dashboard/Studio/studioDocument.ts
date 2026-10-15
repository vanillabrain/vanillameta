import {
  isStudioId,
  STUDIO_BREAKPOINTS,
  STUDIO_COLUMNS,
  STUDIO_DATE_LIMITS,
  STUDIO_FILTER_LIMITS,
  StudioDateRange,
  StudioDocumentV1,
  StudioFilter,
  StudioFilterValue,
  StudioLayoutItem,
} from './studioTypes';
import { timeRangeLabel, validTimeRange, validTimeZone } from '../Components/timeSelection';
export const studioClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function studioAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const record = (value: unknown): value is Record<string, any> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
export function studioKeys(value: unknown, keys: string[]) {
  studioAssert(
    record(value) && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key)),
    '지원하지 않는 문서 필드입니다.',
  );
}
export function studioText(value: unknown, max: number, empty = false) {
  studioAssert(typeof value === 'string' && value.length <= max && (empty || !!value.trim()), '문자열을 확인해 주세요.');
}
export function studioPositive(value: unknown) {
  studioAssert(Number.isSafeInteger(value) && Number(value) > 0, '참조 ID를 확인해 주세요.');
}
export const studioOverlap = (a: StudioLayoutItem, b: StudioLayoutItem) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Typed value identity: 1, "1", true and null are four different filter values. */
export const studioFilterValueKey = (value: StudioFilterValue) => JSON.stringify([typeof value, value]);
export const studioFilterValueLabel = (value: StudioFilterValue) =>
  value === null ? 'NULL' : typeof value === 'boolean' ? String(value).toUpperCase() : String(value);
/** Human-readable scope for labels and chips. Order follows the stored filter list. */
export const studioFilterSummary = (filters: StudioFilter[] | undefined): string =>
  (filters ?? []).map(filter => filter.column + ' ' + filter.values.length + '개 값').join(' · ');
/** One readonly scope chip: readable column plus the first few typed values. */
export const studioFilterChipText = (filter: StudioFilter): string =>
  filter.column +
  ': ' +
  (filter.values.slice(0, 3).map(studioFilterValueLabel).join(', ') || '값 없음') +
  (filter.values.length > 3 ? ' 외 ' + (filter.values.length - 3) + '개' : '');
/** Stable comparison key for one filter set; independent of column order and of value order per column. */
export const studioFilterKey = (filters: StudioFilter[] | undefined): string =>
  studioFilterDraftKey(studioNormalizeFilters(filters ?? []));
/**
 * UI draft identity. Never throws and tolerates a column that has no value yet, so an unfinished
 * panel edit can be compared without treating it as a protocol error. Apply stays strict.
 */
export const studioFilterDraftKey = (filters: StudioFilter[] | undefined): string =>
  JSON.stringify(
    (Array.isArray(filters) ? filters : [])
      .map(filter => [
        typeof filter?.column === 'string' ? filter.column : String(filter?.column),
        (Array.isArray(filter?.values) ? filter.values : []).map(studioFilterValueKey).sort(),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
const studioNormalizeFilters = (input: StudioFilter[]): StudioFilter[] => {
  studioAssert(
    Array.isArray(input) && input.length <= STUDIO_FILTER_LIMITS.columns,
    '공통 필터는 최대 5개 열까지 지원합니다.',
  );
  const seen = new Set<string>();
  return Array.from(input).map(filter => {
    studioKeys(filter, ['column', 'values']);
    studioText(filter.column, STUDIO_FILTER_LIMITS.columnLength);
    studioAssert(!seen.has(filter.column), '같은 열을 두 번 필터링할 수 없습니다.');
    seen.add(filter.column);
    studioAssert(
      Array.isArray(filter.values) && filter.values.length > 0 && filter.values.length <= STUDIO_FILTER_LIMITS.values,
      '필터 값은 열마다 1~50개까지 선택할 수 있습니다.',
    );
    const keys = new Set<string>();
    const values = Array.from(filter.values).map(value => {
      studioAssert(
        value === null ||
          typeof value === 'boolean' ||
          (typeof value === 'string' && value.length <= STUDIO_FILTER_LIMITS.textLength) ||
          (typeof value === 'number' && Number.isFinite(value)),
        '필터 값 형식을 확인해 주세요.',
      );
      const key = studioFilterValueKey(value);
      studioAssert(!keys.has(key), '같은 필터 값을 두 번 선택할 수 없습니다.');
      keys.add(key);
      return value;
    });
    return { column: filter.column, values };
  });
};
/**
 * Structural validation of the common filter list. Mirrors the server protocol: at most five unique
 * columns, one to fifty non-empty primitive values per column, and no duplicate typed values.
 */
export function validateStudioFilters(input: unknown): StudioFilter[] {
  studioAssert(Array.isArray(input), '공통 필터 형식을 확인해 주세요.');
  return studioClone(studioNormalizeFilters(input as StudioFilter[]));
}
/** Mirrors the day predicate in PersonalSavedViews without importing that component module. */
const studioValidDay = (day: unknown): day is string =>
  typeof day === 'string' &&
  /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number(day.slice(0, 4)) >= 1 &&
  !Number.isNaN(Date.parse(day + 'T00:00:00Z')) &&
  new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;
/** Exclusive upper bound of one UTC calendar day; null when the four-digit year would overflow. */
const studioNextDayUtc = (day: string): string | null => {
  const next = new Date(Date.parse(day + 'T00:00:00Z') + 86400000);
  const year = next.getUTCFullYear();
  return Number.isFinite(next.getTime()) && year >= 1 && year <= 9999 ? next.toISOString().slice(0, 10) : null;
};
/**
 * Structural validation of the common period. Calendar days are UTC and end-inclusive; a timestamp
 * range reuses the existing exact-instant rules with an exclusive end.
 */
export function validateStudioDateRange(input: unknown): StudioDateRange {
  studioKeys(input, ['column', 'start', 'end', 'precision', 'timeZone']);
  const range = input as StudioDateRange;
  studioText(range.column, STUDIO_DATE_LIMITS.columnLength);
  // A present field must be valid: an own key holding undefined is rejected, matching the server.
  if (Object.prototype.hasOwnProperty.call(input, 'precision'))
    studioAssert(range.precision === 'timestamp', '기간의 정밀도는 timestamp만 지원합니다.');
  if (Object.prototype.hasOwnProperty.call(input, 'timeZone'))
    studioAssert(
      validTimeZone(range.timeZone),
      '기간의 시간대를 확인해 주세요. UTC 또는 IANA 지역 이름만 사용할 수 있습니다.',
    );
  if (range.precision === 'timestamp') {
    studioAssert(validTimeRange(range), '정밀 기간 형식을 확인해 주세요. UTC 시각과 종료 미포함 범위가 필요합니다.');
  } else {
    studioAssert(
      studioValidDay(range.start) && studioValidDay(range.end) && range.start <= range.end,
      '기간 날짜를 확인해 주세요. UTC 기준 시작일이 종료일보다 늦을 수 없습니다.',
    );
    // The server turns a day range into an exclusive bound, so a day without a next day is unusable.
    studioAssert(studioNextDayUtc(range.end) !== null, '기간 종료일이 지원 범위를 벗어났습니다.');
  }
  return studioClone(range);
}
/** Stable identity of one period; empty string when no period is applied. */
export const studioDateRangeKey = (dateRange: StudioDateRange | null | undefined): string =>
  dateRange
    ? JSON.stringify([
        dateRange.column,
        dateRange.start,
        dateRange.end,
        dateRange.precision ?? 'day',
        dateRange.timeZone ?? 'UTC',
      ])
    : '';
/** Readable period for labels and chips. Never claims more precision than the stored range has. */
export const studioDateRangeSummary = (dateRange: StudioDateRange | null | undefined): string => {
  if (!dateRange) return '전체 기간';
  if (dateRange.precision === 'timestamp') return timeRangeLabel(dateRange);
  const zone = dateRange.timeZone ?? 'UTC';
  return dateRange.column + ' · ' + zone + ' ' + dateRange.start + ' ~ ' + dateRange.end;
};
/**
 * Strict identity of the whole common scope. Both parts are validated, so a malformed scope throws
 * instead of silently collapsing two different scopes into one key.
 */
export const studioScopeKey = (filters: StudioFilter[] | undefined, dateRange: StudioDateRange | null | undefined): string =>
  JSON.stringify([
    studioFilterKey(validateStudioFilters(filters ?? [])),
    dateRange ? studioDateRangeKey(validateStudioDateRange(dateRange)) : '',
  ]);
/** Structural validation only: source ownership and live reference availability are a server concern. */
export function validateStudioDocument(input: unknown): StudioDocumentV1 {
  studioKeys(input, [
    'schemaVersion',
    'dashboardId',
    'revision',
    'title',
    'sourceId',
    'filters',
    'dateRange',
    'blocks',
    'layouts',
  ]);
  const d = input as StudioDocumentV1;
  studioAssert(d.schemaVersion === 1, '지원하지 않는 Studio 문서 버전입니다.');
  studioPositive(d.sourceId);
  if (d.filters !== undefined) validateStudioFilters(d.filters);
  if (d.dateRange !== undefined) validateStudioDateRange(d.dateRange);
  studioText(d.title, 300);
  if (d.dashboardId !== undefined) studioPositive(d.dashboardId);
  if (d.revision !== undefined)
    studioAssert(typeof d.revision === 'string' && /^[a-f0-9]{64}$/.test(d.revision), '문서 revision을 확인해 주세요.');
  studioAssert(Array.isArray(d.blocks) && d.blocks.length <= 6, '현재 최대 6개 블록을 지원합니다.');
  const ids = new Set<string>();
  Array.from(d.blocks).forEach(b => {
    studioKeys(b, ['id', 'kind', 'definitionKey', 'title', 'description', 'measureRefs', 'dimensionRefs', 'display']);
    studioAssert(isStudioId(b.id) && !ids.has(b.id), '블록 ID가 없거나 중복됩니다.');
    ids.add(b.id);
    studioAssert(
      ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'].includes(b.kind),
      '지원하지 않는 블록 종류입니다.',
    );
    studioText(b.definitionKey, 128);
    studioAssert(/^[A-Za-z0-9:_-]+$/.test(b.definitionKey), '정의 참조를 확인해 주세요.');
    studioText(b.title, 300);
    studioText(b.description, 1000, true);
    studioAssert(
      Array.isArray(b.measureRefs) &&
        b.measureRefs.length <= 6 &&
        Array.isArray(b.dimensionRefs) &&
        b.dimensionRefs.length <= 6,
      '지표·차원 참조를 확인해 주세요.',
    );
    const measures = new Set<number>();
    Array.from(b.measureRefs).forEach(m => {
      studioKeys(m, ['id', 'definitionVersion']);
      studioPositive(m.id);
      studioText(m.definitionVersion, 128);
      studioAssert(!measures.has(m.id), '지표 참조가 중복됩니다.');
      measures.add(m.id);
    });
    const dims = new Set<string>();
    Array.from(b.dimensionRefs).forEach(r => {
      studioKeys(r, ['key', 'sourceId', 'schemaVersion']);
      studioText(r.key, 255);
      studioText(r.schemaVersion, 128);
      studioAssert(r.sourceId === d.sourceId && !dims.has(r.key), '차원의 소스가 다르거나 참조가 중복됩니다.');
      dims.add(r.key);
    });
    studioKeys(b.display, ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain']);
    const p = b.display;
    if (p.timeGrain !== undefined)
      studioAssert(
        b.kind === 'CHART_LINE' && ['auto', 'day', 'week', 'month'].includes(p.timeGrain),
        '시간 집계를 확인해 주세요.',
      );
    if (p.decimalPlaces !== undefined)
      studioAssert(
        Number.isInteger(p.decimalPlaces) && p.decimalPlaces >= 0 && p.decimalPlaces <= 6,
        '소수 자릿수를 확인해 주세요.',
      );
    if (p.numberNotation !== undefined)
      studioAssert(['full', 'compact'].includes(p.numberNotation), '숫자 표시를 확인해 주세요.');
    for (const key of ['prefix', 'suffix']) if (p[key] !== undefined) studioText(p[key], 100, true);
  });
  studioKeys(d.layouts, ['lg', 'md', 'xs']);
  for (const bp of STUDIO_BREAKPOINTS) {
    const items = d.layouts[bp];
    studioAssert(Array.isArray(items) && items.length === ids.size, '블록과 배치가 일치하지 않습니다.');
    const seen = new Set<string>();
    Array.from(items).forEach((g, i) => {
      studioKeys(g, ['id', 'x', 'y', 'w', 'h']);
      studioAssert(ids.has(g.id) && !seen.has(g.id), '배치 ID가 없거나 중복됩니다.');
      seen.add(g.id);
      studioAssert(
        [g.x, g.y, g.w, g.h].every(Number.isSafeInteger) &&
          g.x >= 0 &&
          g.y >= 0 &&
          g.w > 0 &&
          g.h > 0 &&
          g.x + g.w <= STUDIO_COLUMNS[bp] &&
          Number.isSafeInteger(g.y + g.h),
        '배치가 허용 범위를 벗어났습니다.',
      );
      studioAssert(
        items.slice(0, i).every(other => !studioOverlap(g, other)),
        '블록 배치가 겹칩니다.',
      );
    });
  }
  return studioClone(d);
}
