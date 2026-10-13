import { BadRequestException } from '@nestjs/common';
import {
  DashboardDateRange,
  dateRangeBounds,
  isoSecond,
  UTC_MIN,
  utcInstant,
  validateDateRange,
} from './dashboard-date-range';

export type PeriodGrain = 'auto' | 'day' | 'week' | 'month';
export type PeriodDateRange = DashboardDateRange;

export function validatePeriodOptions(body: any): {
  trendGrain: PeriodGrain;
  comparePrevious: boolean;
} {
  const trendGrain = body?.trendGrain === undefined ? 'auto' : body.trendGrain;
  const comparePrevious = body?.comparePrevious === undefined ? false : body.comparePrevious;
  if (!['auto', 'day', 'week', 'month'].includes(trendGrain))
    throw new BadRequestException('invalid trend grain');
  if (typeof comparePrevious !== 'boolean')
    throw new BadRequestException('invalid previous period option');
  return { trendGrain, comparePrevious };
}

/** Immediately preceding period: inclusive days or an equal number of UTC seconds. */
export function previousDateRange(
  range: PeriodDateRange,
  timeZone = range?.timeZone ?? 'UTC',
): PeriodDateRange {
  range = validateDateRange(range);
  // Calendar comparisons retain equal date counts, not equal elapsed hours across DST.
  if (timeZone !== 'UTC') dateRangeBounds(range, timeZone);
  const timestamp = range.precision === 'timestamp';
  // Civil strings are date labels: UTC arithmetic advances labels, not regional instants.
  // Resolve both resulting periods separately through dateRangeBounds with the same zone.
  const start = utcInstant(range.start, timestamp);
  const end = utcInstant(range.end, timestamp);
  const length = end - start + (timestamp ? 0 : 86400000);
  const previousStart = start - length;
  const previousEnd = start - (timestamp ? 0 : 86400000);
  if (!Number.isFinite(previousStart) || !Number.isFinite(previousEnd) || previousStart < UTC_MIN)
    throw new BadRequestException('previous UTC date range underflow');
  const previous: PeriodDateRange = {
    column: range.column,
    start: timestamp
      ? isoSecond(previousStart)
      : new Date(previousStart).toISOString().slice(0, 10),
    end: timestamp ? isoSecond(previousEnd) : new Date(previousEnd).toISOString().slice(0, 10),
    ...(timestamp ? { precision: 'timestamp' as const } : {}),
    ...(range.timeZone !== undefined ? { timeZone: range.timeZone } : {}),
  };
  if (timeZone !== 'UTC') dateRangeBounds(previous, timeZone);
  return previous;
}

function finiteValue(value: unknown): number | null {
  if (
    typeof value !== 'number' &&
    !(typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))
  )
    return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function outsideExactRange(value: number | null): boolean {
  return value !== null && Math.abs(value) > Number.MAX_SAFE_INTEGER;
}

/** Decimal/scientific strings at the integer boundary can round inward on conversion. */
function roundedBoundary(value: unknown, numeric: number | null): boolean {
  return (
    typeof value === 'string' &&
    numeric !== null &&
    Math.abs(numeric) >= Number.MAX_SAFE_INTEGER &&
    !/^[+-]?\d+$/.test(value)
  );
}

export function comparisonValues(
  current: unknown,
  previous: unknown,
): {
  previousValue: number | null;
  delta: number | null;
  percentChange: number | null;
  unavailable?: string;
} {
  const currentValue = finiteValue(current);
  const previousValue = finiteValue(previous);
  const delta =
    currentValue === null || previousValue === null
      ? null
      : finiteValue(currentValue - previousValue);
  const unsafePrevious =
    outsideExactRange(previousValue) || roundedBoundary(previous, previousValue);
  if (
    outsideExactRange(currentValue) ||
    unsafePrevious ||
    outsideExactRange(delta) ||
    roundedBoundary(current, currentValue) ||
    roundedBoundary(previous, previousValue)
  )
    return {
      previousValue: unsafePrevious ? null : previousValue,
      delta: null,
      percentChange: null,
      unavailable: '정확한 비교 범위를 초과합니다.',
    };
  const percentChange =
    delta === null || previousValue === null || previousValue === 0
      ? null
      : finiteValue((delta / Math.abs(previousValue)) * 100);
  return { previousValue, delta, percentChange };
}
