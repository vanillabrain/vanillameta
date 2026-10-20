import type { DateRange } from './PersonalSavedViews';
import { MetricTrendData, TrendPoint, trendGeometry } from './trendGeometry';

const dayMs = 86400000;
export type TrendPeriods = { current: DateRange; previous: DateRange };

/** Draw only matching UTC daily buckets; absent days remain gaps, never zeroes. */
export function comparisonTrend(current: MetricTrendData, previous: MetricTrendData, periods: TrendPeriods) {
  const ranges = [periods.current, periods.previous];
  if (current.grain !== 'day' || previous.grain !== 'day' || current.column !== previous.column) return;
  if (
    ranges.some(range => range.precision || range.column !== current.column || (range.timeZone && range.timeZone !== 'UTC'))
  )
    return;
  const dates = ranges.flatMap(range => [range.start, range.end]);
  if (
    dates.some(
      date =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date,
    )
  )
    return;
  const [start, end, previousStart, previousEnd] = dates.map(Date.parse);
  const days = (end - start) / dayMs + 1;
  if (days < 1 || days > 240 || end - start !== previousEnd - previousStart) return;
  const dense = (trend: MetricTrendData, origin: number): TrendPoint[] | undefined => {
    const values = new Map<number, number | null>();
    for (const point of trend.points) {
      const offset = (Date.parse(point.time) - origin) / dayMs;
      if (!Number.isInteger(offset) || offset < 0 || offset >= days || values.has(offset)) return;
      values.set(offset, point.value);
    }
    return Array.from({ length: days }, (_, index) => ({
      time: new Date(start + index * dayMs).toISOString(),
      value: values.get(index) ?? null,
    }));
  };
  const currentPoints = dense(current, start),
    previousPoints = dense(previous, previousStart);
  if (!currentPoints || !previousPoints) return;
  const values = [...currentPoints, ...previousPoints]
    .filter(point => point.value !== null && Number.isFinite(point.value))
    .map(point => point.value as number);
  const axes = { start, end, min: Math.min(0, ...values), max: Math.max(0, ...values) };
  return { axes, current: trendGeometry(currentPoints, axes), previous: trendGeometry(previousPoints, axes) };
}
