import { BadRequestException } from '@nestjs/common';

export interface DashboardDateRange {
  column: string;
  start: string;
  end: string;
  precision?: 'timestamp';
  timeZone?: string;
}
export const UTC_MIN = Date.parse('0001-01-01T00:00:00Z');
export const UTC_MAX = Date.parse('9999-12-31T23:59:59Z');

/** Explicit IANA region names (or UTC); never fall back to the host timezone. */
export function validateBusinessTimeZone(value: unknown = 'UTC'): string {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value))
  )
    throw new BadRequestException('invalid business timezone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    throw new BadRequestException('invalid business timezone');
  }
}

function businessCalendar(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: validateBusinessTimeZone(timeZone),
    calendar: 'gregory',
    numberingSystem: 'latn',
    era: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function calendarParts(format: Intl.DateTimeFormat, instant: number) {
  const parts = Object.fromEntries(
    format.formatToParts(instant).map(part => [part.type, part.value]),
  );
  const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  return { year, month: Number(parts.month), day: Number(parts.day) };
}

/** Calendar date for relative periods; UTC remains the legacy default. */
export function businessDate(now: Date, timeZone = 'UTC'): string {
  if (!Number.isFinite(now.getTime())) throw new BadRequestException('invalid business date');
  const { year, month, day } = calendarParts(businessCalendar(timeZone), now.getTime());
  if (year < 1 || year > 9999) throw new BadRequestException('business date range overflow');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0',
  )}`;
}

/** First instant of a civil date, including days whose midnight is skipped by DST. */
function businessDayStart(day: string, format: Intl.DateTimeFormat): number {
  const calendarMidnight = utcInstant(day, false);
  const ordinal = (instant: number) => {
    const p = calendarParts(format, instant);
    return p.year * 10000 + p.month * 100 + p.day;
  };
  const target = Number(day.replace(/-/g, ''));
  // Search in seconds, preserving historical offsets with second precision.
  let lower = calendarMidnight / 1000 - 48 * 3600;
  let upper = calendarMidnight / 1000 + 48 * 3600;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (ordinal(middle * 1000) < target) lower = middle + 1;
    else upper = middle;
  }
  const result = lower * 1000;
  if (ordinal(result) !== target)
    throw new BadRequestException('business calendar date does not exist');
  if (result < UTC_MIN || result > UTC_MAX)
    throw new BadRequestException('business date range overflow');
  return result;
}

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
    Object.keys(input).some(
      key => !['column', 'start', 'end', 'precision', 'timeZone'].includes(key),
    ) ||
    typeof input.column !== 'string' ||
    !input.column.trim() ||
    input.column.length > 128 ||
    ('precision' in input && input.precision !== 'timestamp')
  )
    throw new BadRequestException('invalid UTC date range');
  if ('timeZone' in input) {
    if (input.timeZone === undefined) throw new BadRequestException('invalid business timezone');
    validateBusinessTimeZone(input.timeZone);
  }
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
    ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
  };
}

/** Half-open bounds: zones interpret calendar dates; timestamps remain absolute UTC instants. */
export function dateRangeBounds(
  input: DashboardDateRange,
  timeZone = input?.timeZone ?? 'UTC',
): { start: number; end: number } {
  const range = validateDateRange(input);
  validateBusinessTimeZone(timeZone);
  const timestamp = range.precision === 'timestamp';
  if (!timestamp && timeZone !== 'UTC') {
    const format = businessCalendar(timeZone);
    const start = businessDayStart(range.start, format);
    // Validate the selected end itself, rather than silently normalizing a skipped date.
    businessDayStart(range.end, format);
    if (range.end === '9999-12-31') throw new BadRequestException('business date range overflow');
    const next = new Date(utcInstant(range.end, false) + 86400000).toISOString().slice(0, 10);
    // A skipped next date still denotes the same boundary as the following date.
    let endDay = next;
    let end: number;
    try {
      end = businessDayStart(endDay, format);
    } catch (error) {
      if (
        !(error instanceof BadRequestException) ||
        error.message !== 'business calendar date does not exist'
      )
        throw error;
      endDay = new Date(utcInstant(next, false) + 86400000).toISOString().slice(0, 10);
      end = businessDayStart(endDay, format);
    }
    if (end <= start) throw new BadRequestException('invalid business date range');
    return { start, end };
  }
  const start = utcInstant(range.start, timestamp);
  const end = utcInstant(range.end, timestamp) + (timestamp ? 0 : 86400000);
  if (end > UTC_MAX) throw new BadRequestException('UTC date range overflow');
  return { start, end };
}

export const isoSecond = (instant: number) => new Date(instant).toISOString().replace('.000Z', 'Z');

/** Internal adapter for the existing half-open UTC query/details contract. */
export function resolveBusinessDateRange(
  input: DashboardDateRange,
  timeZone = input?.timeZone ?? 'UTC',
): DashboardDateRange {
  const { start, end } = dateRangeBounds(input, timeZone);
  return {
    column: input.column,
    start: isoSecond(start),
    end: isoSecond(end),
    precision: 'timestamp',
  };
}
