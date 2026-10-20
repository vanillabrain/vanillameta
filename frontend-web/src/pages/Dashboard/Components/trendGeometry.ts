export type TrendPoint = { time: string; value: number | null };
export type MetricTrendData = {
  column: string;
  grain: string;
  points: TrendPoint[];
  timeZone?: string;
  timeSelectionUnavailable?: string;
  timeSelection?: import('./timeSelection').TimeSelection;
  contribution?: { supported: boolean; groupFingerprint?: string; reason?: string };
};

/** Display name for the trend's bucket zone; omitted or UTC keeps the legacy UTC label. */
export const trendTimeZone = (timeZone?: string) => (timeZone && timeZone !== 'UTC' ? timeZone : 'UTC');

/**
 * Bucket label for a point whose `time` is the UTC instant at the bucket start. An explicit non-UTC
 * zone renders the local calendar date (date-time for hourly buckets) via Intl; omitted or UTC keeps
 * the legacy UTC string unchanged, and an unusable zone falls back to it rather than throwing.
 */
export function trendBucketLabel(time: string, grain: string | undefined, timeZone?: string): string {
  const legacy = (value: string) => (grain === 'hour' ? value.slice(0, 16).replace('T', ' ') : value.slice(0, 10));
  if (!timeZone || timeZone === 'UTC') return legacy(time);
  const instant = Date.parse(time);
  if (!Number.isFinite(instant)) return legacy(time);
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        calendar: 'gregory',
        numberingSystem: 'latn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(grain === 'hour' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
      })
        .formatToParts(instant)
        .map(part => [part.type, part.value]),
    );
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    return grain === 'hour' ? `${date} ${parts.hour}:${parts.minute}` : date;
  } catch {
    return legacy(time);
  }
}

/** Null observations break the line rather than implying a zero or interpolation. */
export type TrendAxes = { start: number; end: number; min: number; max: number };

export function trendGeometry(points: TrendPoint[], axes?: TrendAxes) {
  const values = points.filter(p => Number.isFinite(p.value) && p.value !== null).map(p => p.value as number);
  if (!values.length) return { path: '', area: '', dots: [] as { x: number; y: number }[] };
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  const dates = points.map(p => Date.parse(p.time));
  const start = axes?.start ?? Math.min(...dates);
  const span = (axes?.end ?? Math.max(...dates)) - start;
  const min = axes?.min ?? Math.min(0, ...values);
  const range = (axes?.max ?? Math.max(0, ...values)) - min;
  let connected = false;
  const dots = [];
  const path = points
    .map((point, index) => {
      if (point.value === null || !Number.isFinite(point.value)) {
        connected = false;
        current = [];
        return '';
      }
      const x = span ? 4 + ((dates[index] - start) / span) * 592 : 300;
      const y = range ? 52 - ((point.value - min) / range) * 44 : 30;
      dots.push({ x, y });
      if (!current.length) segments.push(current);
      current.push({ x, y });
      const segment = `${connected ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
      connected = true;
      return segment;
    })
    .join(' ');
  const baseline = range ? 52 - ((0 - min) / range) * 44 : 30;
  const area = segments
    .map(
      segment =>
        `M${segment[0].x},${baseline} ${segment.map(dot => `L${dot.x},${dot.y}`).join(' ')} L${
          segment[segment.length - 1].x
        },${baseline} Z`,
    )
    .join(' ');
  return { path, area, dots };
}
