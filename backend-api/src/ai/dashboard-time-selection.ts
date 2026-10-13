import {
  DashboardDateRange,
  businessDate,
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

/** Canonical local calendar buckets, including DST-short/long days. */
function regionalBounds(value: unknown, bucket: TimeBucket, zone: string) {
  if (bucket.grain === 'hour' || typeof value !== 'string') return undefined;
  try {
    const instant = utcInstant(value, true);
    const day = businessDate(new Date(instant), zone);
    const calendar = new Date(`${day}T00:00:00Z`);
    if (bucket.grain === 'week' && calendar.getUTCDay() !== 1) return undefined;
    if (bucket.grain === 'month' && calendar.getUTCDate() !== 1) return undefined;
    if (bucket.grain === 'month') calendar.setUTCMonth(calendar.getUTCMonth() + 1);
    else calendar.setUTCDate(calendar.getUTCDate() + (bucket.grain === 'week' ? 7 : 1));
    // The last included civil date allows dateRangeBounds to handle a skipped next date.
    calendar.setUTCDate(calendar.getUTCDate() - 1);
    const bounds = dateRangeBounds({
      column: bucket.column,
      start: day,
      end: calendar.toISOString().slice(0, 10),
      timeZone: zone,
    });
    return bounds.start === instant ? bounds : undefined;
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
      const zone = appliedRange?.timeZone;
      if (zone && zone !== 'UTC') {
        const bounds = regionalBounds(value, bucket, zone);
        if (!bounds) return null;
        const start = Math.max(bounds.start, applied?.start ?? bounds.start);
        const end = Math.min(bounds.end, applied?.end ?? bounds.end);
        return start < end
          ? {
              column: bucket.column,
              start: isoSecond(start),
              end: isoSecond(end),
              precision: 'timestamp' as const,
              timeZone: zone,
            }
          : null;
      }
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
