import type { DateRange } from './PersonalSavedViews';
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) return false;
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type TimeSelection = {
  column: string;
  grain: 'hour' | 'day' | 'week' | 'month';
  ranges: Array<DateRange | null>;
};

const validInstant = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === value;
};

/** Consume server-proven buckets; never infer their meaning from a formatted chart label. */
export function validTimeRange(range: unknown): range is DateRange {
  const value = range as DateRange | undefined;
  return (
    !!value &&
    (value.timeZone === undefined || validTimeZone(value.timeZone)) &&
    typeof value.column === 'string' &&
    !!value.column &&
    value.precision === 'timestamp' &&
    validInstant(value.start) &&
    validInstant(value.end) &&
    value.start < value.end
  );
}

export function sameTimeRange(a?: DateRange | null, b?: DateRange | null) {
  return (
    !!a &&
    !!b &&
    a.column === b.column &&
    a.start === b.start &&
    a.end === b.end &&
    a.precision === b.precision &&
    (a.timeZone ?? 'UTC') === (b.timeZone ?? 'UTC')
  );
}

export function timeRangeLabel(range: DateRange) {
  if (range.timeZone && range.timeZone !== 'UTC') {
    const format = new Intl.DateTimeFormat('sv-SE', {
      timeZone: range.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    return `${range.timeZone} ${format.format(new Date(range.start))} ~ ${format.format(new Date(range.end))} (종료 미포함)`;
  }
  return `UTC ${range.start.replace('T', ' ').replace('Z', '')} ~ ${range.end
    .replace('T', ' ')
    .replace('Z', '')} (종료 미포함)`;
}

export function categoryTimeRange(
  rows: any[],
  field: string,
  category: unknown,
  selection?: TimeSelection,
): DateRange | undefined {
  if (!selection || selection.ranges.length !== rows.length) return;
  let matched: DateRange | undefined;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][field] !== category) continue;
    const range = selection.ranges[i];
    if (!validTimeRange(range) || range.column !== selection.column || (matched && !sameTimeRange(matched, range))) return;
    matched = range;
  }
  return matched;
}
