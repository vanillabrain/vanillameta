import {
  DashboardDateRange,
  dateRangeBounds,
  isoSecond,
  UTC_MAX,
  UTC_MIN,
  utcInstant,
} from './dashboard-date-range';
import { TimeBucket } from './dashboard-trend';

export interface TimeSelection {
  column: string;
  grain: TimeBucket['grain'];
  ranges: Array<(DashboardDateRange & { precision: 'timestamp' }) | null>;
}

function bucketStart(value: unknown, bucket: TimeBucket): number | undefined {
  if (typeof value !== 'string') return undefined;
  let time = value;
  if (bucket.format === 'month') {
    if (!/^(?!0000)\d{4}-\d{2}$/.test(time)) return undefined;
    time += '-01T00:00:00Z';
  } else if (
    bucket.format === 'day' ||
    (bucket.format === 'duckdb' && /^\d{4}-\d{2}-\d{2}$/.test(time))
  ) {
    time += 'T00:00:00Z';
  } else if (bucket.format === 'duckdb') {
    // DuckDB's temporal value serialization; accept only UTC, with zero fractions.
    time = time.replace(/(?:\.0{1,6})?(?:\+00(?::00)?|Z)?$/, '').replace(' ', 'T') + 'Z';
  }
  time = time.replace(/\.000Z$/, 'Z');
  try {
    const instant = utcInstant(time, true);
    const date = new Date(instant);
    if (date.getUTCMinutes() || date.getUTCSeconds()) return undefined;
    if (bucket.grain !== 'hour' && date.getUTCHours()) return undefined;
    if (bucket.grain === 'week' && date.getUTCDay() !== 1) return undefined;
    if (bucket.grain === 'month' && date.getUTCDate() !== 1) return undefined;
    return instant;
  } catch {
    return undefined;
  }
}

/** Preserve row order; replacing a different-column period would broaden the filter scope. */
export function buildTimeSelection(
  values: unknown[],
  bucket: TimeBucket,
  appliedRange?: DashboardDateRange,
): TimeSelection | undefined {
  if (values.length > 240 || (appliedRange && appliedRange.column !== bucket.column))
    return undefined;
  const applied =
    appliedRange?.column === bucket.column ? dateRangeBounds(appliedRange) : undefined;
  return {
    column: bucket.column,
    grain: bucket.grain,
    ranges: values.map(value => {
      const instant = bucketStart(value, bucket);
      if (instant === undefined) return null;
      const next = new Date(instant);
      if (bucket.grain === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
      else if (bucket.grain === 'hour') next.setUTCHours(next.getUTCHours() + 1);
      else next.setUTCDate(next.getUTCDate() + (bucket.grain === 'week' ? 7 : 1));
      let start = instant;
      let end = next.getTime();
      if (!Number.isFinite(end) || start < UTC_MIN || end > UTC_MAX) return null;
      if (applied) {
        start = Math.max(start, applied.start);
        end = Math.min(end, applied.end);
      }
      return start < end
        ? {
            column: bucket.column,
            start: isoSecond(start),
            end: isoSecond(end),
            precision: 'timestamp' as const,
          }
        : null;
    }),
  };
}
