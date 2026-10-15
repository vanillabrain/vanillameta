/** Shared ECharts presentation only: data, saved colors and formatters remain owned by each chart. */
export const chartColors = {
  primary: '#4f46e5',
  comparison: '#0f766e',
  refund: '#b45309',
  muted: '#667085',
  border: '#e4e7ec',
};

const axis = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: chartColors.muted, fontSize: 12, margin: 12, hideOverlap: true },
  nameTextStyle: { color: chartColors.muted, fontSize: 12 },
  splitLine: { show: false },
};

// A theme supplies defaults; ECharts keeps explicit widget colors and option overrides authoritative.
export const chartTheme = {
  color: [chartColors.primary, chartColors.comparison, chartColors.refund, '#9333ea', '#475569'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 12, color: '#182230' },
  categoryAxis: axis,
  valueAxis: { ...axis, splitLine: { show: true, lineStyle: { color: chartColors.border, type: 'dashed' } } },
  legend: {
    type: 'scroll',
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 20,
    textStyle: { color: chartColors.muted, fontSize: 12 },
    pageTextStyle: { color: chartColors.muted },
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: chartColors.border,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: '#182230', fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 12 },
    extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgb(16 24 40 / 8%);',
    confine: true,
  },
  line: { symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 } },
  bar: { barMaxWidth: 32 },
};
