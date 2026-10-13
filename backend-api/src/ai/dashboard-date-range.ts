import { BadRequestException } from '@nestjs/common';

export interface DashboardDateRange {
  column: string;
  start: string;
  end: string;
  precision?: 'timestamp';
}
export const UTC_MIN = Date.parse('0001-01-01T00:00:00Z');
export const UTC_MAX = Date.parse('9999-12-31T23:59:59Z');

export function utcInstant(value: unknown, timestamp: boolean): number {
  const pattern = timestamp
    ? /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    : /^(?!0000)\d{4}-\d{2}-\d{2}$/;
  if (typeof value !== 'string' || !pattern.test(value))
    throw new BadRequestException('invalid UTC date range');
  const instant = Date.parse(timestamp ? value : `${value}T00:00:00Z`);
  if (
    !Number.isFinite(instant) ||
    (timestamp
      ? new Date(instant).toISOString().replace('.000Z', 'Z')
      : new Date(instant).toISOString().slice(0, 10)) !== value
  )
    throw new BadRequestException('invalid UTC date range');
  return instant;
}

export function validateDateRange(input: any): DashboardDateRange {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(key => !['column', 'start', 'end', 'precision'].includes(key)) ||
    typeof input.column !== 'string' ||
    !input.column.trim() ||
    input.column.length > 128 ||
    ('precision' in input && input.precision !== 'timestamp')
  )
    throw new BadRequestException('invalid UTC date range');
  const timestamp = input.precision === 'timestamp';
  const start = utcInstant(input.start, timestamp);
  const end = utcInstant(input.end, timestamp);
  if (timestamp ? end <= start : end < start)
    throw new BadRequestException('invalid UTC date range');
  return {
    column: input.column,
    start: input.start,
    end: input.end,
    ...(timestamp ? { precision: 'timestamp' as const } : {}),
  };
}

/** Query bounds are always half-open, including legacy inclusive day selections. */
export function dateRangeBounds(input: DashboardDateRange): { start: number; end: number } {
  const range = validateDateRange(input);
  const timestamp = range.precision === 'timestamp';
  const start = utcInstant(range.start, timestamp);
  const end = utcInstant(range.end, timestamp) + (timestamp ? 0 : 86400000);
  if (end > UTC_MAX) throw new BadRequestException('UTC date range overflow');
  return { start, end };
}

export const isoSecond = (instant: number) => new Date(instant).toISOString().replace('.000Z', 'Z');
