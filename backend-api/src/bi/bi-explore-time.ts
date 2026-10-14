import { BadRequestException } from '@nestjs/common';
import { quoteColumn } from '../ai/dashboard-draft';
import { validateBusinessTimeZone, validateDateRange } from '../ai/dashboard-date-range';

export type PivotTimeAxis = { column: string; grain: 'day' | 'week' | 'month'; timeZone: string };
export type PivotBucket = { axis: PivotTimeAxis; civil: boolean; shift: number; utcShift: boolean };

/** One temporal axis, validated against the live catalog before SQL generation. */
export function pivotBucket(
  value: unknown,
  columns: any[],
  axes: string[],
  dateRange: any,
): PivotBucket | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('invalid timeAxis');
  const input = value as any;
  if (
    Object.keys(input).some(key => !['column', 'grain', 'timeZone'].includes(key)) ||
    typeof input.column !== 'string' ||
    !['day', 'week', 'month'].includes(input.grain) ||
    typeof input.timeZone !== 'string'
  )
    throw new BadRequestException('invalid timeAxis');
  const column = columns.find(column => column.name === input.column);
  if (!column?.temporal || !axes.includes(input.column))
    throw new BadRequestException('시간 축에는 배치한 날짜 열이 필요합니다.');
  const timeZone = validateBusinessTimeZone(input.timeZone);
  if (dateRange !== undefined && timeZone !== (validateDateRange(dateRange).timeZone ?? 'UTC'))
    throw new BadRequestException('시간 축과 기간의 시간대를 일치시켜 주세요.');
  return {
    axis: { column: input.column, grain: input.grain, timeZone },
    civil: String(column.type).toUpperCase() === 'DATE',
    shift: 0,
    utcShift: false,
  };
}

/** Align previous records to the current period before bucketing, preserving civil days across DST. */
export function previousBucket(
  bucket: PivotBucket | undefined,
  current: any,
  previous: any,
): PivotBucket | undefined {
  if (!bucket || !previous) return bucket;
  const timestamp = current.precision === 'timestamp';
  const start = (range: any) => Date.parse(timestamp ? range.start : `${range.start}T00:00:00Z`);
  const currentStart = start(current);
  const previousStart = start(previous);
  if (!Number.isFinite(currentStart) || !Number.isFinite(previousStart))
    throw new BadRequestException('비교 기간의 시작 시점을 확인해 주세요.');
  return { ...bucket, shift: (currentStart - previousStart) / 1000, utcShift: timestamp };
}

/** All tokens come from catalog membership, enums or validated IANA names; no client SQL. */
export function pivotAxisExpression(column: string, bucket?: PivotBucket): string {
  const raw = quoteColumn(column);
  if (!bucket || bucket.axis.column !== column) return raw;
  let instant = raw;
  if (bucket.shift && bucket.utcShift)
    instant = `(${instant} + INTERVAL '${bucket.shift} seconds')`;
  let local =
    bucket.axis.timeZone !== 'UTC' && !bucket.civil
      ? `(CAST(${instant} AS TIMESTAMPTZ) AT TIME ZONE '${bucket.axis.timeZone}')`
      : instant;
  if (bucket.shift && !bucket.utcShift) local = `(${local} + INTERVAL '${bucket.shift} seconds')`;
  return `strftime(date_trunc('${bucket.axis.grain}', ${local}), '%Y-%m-%d')`;
}
