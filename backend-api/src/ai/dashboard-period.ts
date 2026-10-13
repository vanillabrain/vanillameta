import { BadRequestException } from '@nestjs/common';

export type PeriodGrain = 'auto' | 'day' | 'week' | 'month';
export interface PeriodDateRange {
  column: string;
  start: string;
  end: string;
}

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

function utcDay(value: unknown): number {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('invalid UTC date range');
  const day = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== value)
    throw new BadRequestException('invalid UTC date range');
  return day;
}

/** Inclusive day ranges, with the immediately preceding equally long period. */
export function previousDateRange(range: PeriodDateRange): PeriodDateRange {
  if (!range || typeof range.column !== 'string' || !range.column.trim())
    throw new BadRequestException('invalid UTC date range');
  const start = utcDay(range.start);
  const end = utcDay(range.end);
  if (end < start) throw new BadRequestException('invalid UTC date range');
  const length = end - start + 86400000;
  const previousStart = start - length;
  const previousEnd = start - 86400000;
  if (
    !Number.isFinite(previousStart) ||
    !Number.isFinite(previousEnd) ||
    previousStart < utcDay('0001-01-01')
  )
    throw new BadRequestException('previous UTC date range underflow');
  return {
    column: range.column,
    start: new Date(previousStart).toISOString().slice(0, 10),
    end: new Date(previousEnd).toISOString().slice(0, 10),
  };
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
