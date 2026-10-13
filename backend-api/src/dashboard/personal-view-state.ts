import { BadRequestException } from '@nestjs/common';

export type ViewDateRange = { column: string; start: string; end: string };
export type PersonalViewState = {
  version: 1;
  filters: { column: string; values: (string | number | boolean | null)[] }[];
  dateRange: ViewDateRange | null;
  relativePeriod: { column: string; days: 7 | 30 | 90 } | null;
  numberNotation: 'auto' | 'compact' | 'full';
  trendGrain?: 'auto' | 'day' | 'week' | 'month';
  comparePrevious?: boolean;
};
const invalid = () => {
  throw new BadRequestException('저장 보기의 기간·필터 형식을 확인해 주세요.');
};
const object = (value: any, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (Object.keys(value).some(key => !keys.includes(key))) invalid();
};
const column = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) invalid();
};
const validDay = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) invalid();
};

export function validatePersonalViewState(input: any): PersonalViewState {
  object(input, [
    'version',
    'filters',
    'dateRange',
    'relativePeriod',
    'numberNotation',
    'trendGrain',
    'comparePrevious',
  ]);
  if (input.version !== 1 || !['auto', 'compact', 'full'].includes(input.numberNotation)) invalid();
  if (
    Object.prototype.hasOwnProperty.call(input, 'trendGrain') &&
    (typeof input.trendGrain !== 'string' ||
      !['auto', 'day', 'week', 'month'].includes(input.trendGrain))
  )
    invalid();
  if (
    Object.prototype.hasOwnProperty.call(input, 'comparePrevious') &&
    typeof input.comparePrevious !== 'boolean'
  )
    invalid();
  if (!Array.isArray(input.filters) || input.filters.length > 5) invalid();
  const names = new Set<string>();
  for (const filter of input.filters) {
    object(filter, ['column', 'values']);
    column(filter.column);
    if (names.has(filter.column)) invalid();
    names.add(filter.column);
    if (!Array.isArray(filter.values) || !filter.values.length || filter.values.length > 50)
      invalid();
    for (const value of filter.values) {
      if (
        value !== null &&
        !(
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value)) ||
          (typeof value === 'string' && value.length <= 256)
        )
      )
        invalid();
    }
  }
  if (input.dateRange !== null) {
    object(input.dateRange, ['column', 'start', 'end']);
    column(input.dateRange.column);
    validDay(input.dateRange.start);
    validDay(input.dateRange.end);
    if (input.dateRange.start > input.dateRange.end) invalid();
  }
  if (input.relativePeriod !== null) {
    object(input.relativePeriod, ['column', 'days']);
    column(input.relativePeriod.column);
    if (![7, 30, 90].includes(input.relativePeriod.days) || input.dateRange !== null) invalid();
  }
  if (input.comparePrevious === true && input.dateRange === null && input.relativePeriod === null)
    invalid();
  return JSON.parse(JSON.stringify(input));
}

/** Relative periods include today and are resolved afresh on each open, in UTC. */
export function resolveViewDates(state: PersonalViewState, now = new Date()): ViewDateRange | null {
  if (!state.relativePeriod) return state.dateRange;
  const end = now.toISOString().slice(0, 10);
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - state.relativePeriod.days + 1);
  return { column: state.relativePeriod.column, start: start.toISOString().slice(0, 10), end };
}
