export type TrendPoint = { time: string; value: number | null };
export type MetricTrendData = {
  column: string;
  grain: string;
  points: TrendPoint[];
  timeSelection?: import('./timeSelection').TimeSelection;
};

/** Null observations break the line rather than implying a zero or interpolation. */
export function trendGeometry(points: TrendPoint[]) {
  const values = points.filter(p => Number.isFinite(p.value) && p.value !== null).map(p => p.value as number);
  if (!values.length) return { path: '', area: '', dots: [] as { x: number; y: number }[] };
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  const dates = points.map(p => Date.parse(p.time));
  const start = Math.min(...dates);
  const span = Math.max(...dates) - start;
  const min = Math.min(0, ...values);
  const range = Math.max(0, ...values) - min;
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
