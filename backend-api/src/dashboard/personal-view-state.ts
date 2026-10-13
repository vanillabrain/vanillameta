import { BadRequestException } from '@nestjs/common';
import {
  businessDate,
  DashboardDateRange,
  dateRangeBounds,
  validateBusinessTimeZone,
} from '../ai/dashboard-date-range';

export type ViewDateRange = DashboardDateRange;
export type PersonalViewState = {
  version: 1;
  filters: { column: string; values: (string | number | boolean | null)[] }[];
  dateRange: ViewDateRange | null;
  relativePeriod: { column: string; days: 7 | 30 | 90; timeZone?: string } | null;
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
    dateRangeBounds(input.dateRange);
  }
  if (input.relativePeriod !== null) {
    object(input.relativePeriod, ['column', 'days', 'timeZone']);
    if ('timeZone' in input.relativePeriod) {
      if (input.relativePeriod.timeZone === undefined) invalid();
      validateBusinessTimeZone(input.relativePeriod.timeZone);
    }
    column(input.relativePeriod.column);
    if (![7, 30, 90].includes(input.relativePeriod.days) || input.dateRange !== null) invalid();
  }
  if (input.comparePrevious === true && input.dateRange === null && input.relativePeriod === null)
    invalid();
  return JSON.parse(JSON.stringify(input));
}

/** Relative periods include calendar today, resolved on each open; default remains UTC. */
export function resolveViewDates(
  state: PersonalViewState,
  now = new Date(),
  timeZone = state.relativePeriod?.timeZone ?? state.dateRange?.timeZone ?? 'UTC',
): ViewDateRange | null {
  if (!state.relativePeriod) return state.dateRange;
  const end = businessDate(now, timeZone);
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - state.relativePeriod.days + 1);
  return {
    column: state.relativePeriod.column,
    start: start.toISOString().slice(0, 10),
    end,
    ...(state.relativePeriod.timeZone !== undefined
      ? { timeZone: state.relativePeriod.timeZone }
      : {}),
  };
}
