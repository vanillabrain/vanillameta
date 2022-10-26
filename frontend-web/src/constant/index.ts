export const WIDGET_TYPE = {
  CHART_LINE: { type: 'CHART_LINE', name: '선형 차트', description: 'Line Chart', icon: 'icon/ct-line.svg' },
  CHART_AREA: { type: 'CHART_AREA', name: '영역형 차트', description: 'Area Chart', icon: 'icon/ct-area.svg' },
  CHART_BAR: { type: 'CHART_BAR', name: '세로 막대형 차트', description: 'Bar Chart', icon: 'icon/ct-bar.svg' },
  CHART_COLUMN: { type: 'CHART_COLUMN', name: '가로 막대형 차트', description: 'Column Chart', icon: 'icon/ct-column.svg' },
  MIXED_CHART_LINE_BAR: {
    type: 'MIXED_CHART_LINE_BAR',
    name: '선형과 세로 막대형 복합 차트',
    description: 'Mixed Line and Bar Chart',
    icon: 'icon/ct-bar-line.svg',
  },
  CHART_PIE: { type: 'CHART_PIE', name: '원형 차트', description: 'Pie Chart', icon: 'icon/ct-pie.svg' },
  CHART_NIGHTINGALE: {
    type: 'CHART_NIGHTINGALE',
    name: '나이팅게일 차트',
    description: 'Nightingale Chart',
    icon: 'icon/ct-nightingale.svg',
  },
  CHART_BUBBLE: { type: 'CHART_BUBBLE', name: '거품형 차트', description: 'Bubble Chart', icon: 'icon/ct-bubble.svg' },
  CHART_RADAR: { type: 'CHART_RADAR', name: '방사형 차트', description: 'Radar Chart', icon: 'icon/ct-radar.svg' },
  CHART_SCATTER: { type: 'CHART_SCATTER', name: '분산형 차트', description: 'Scatter Chart', icon: 'icon/ct-scatter.svg' },
  CHART_DONUT: { type: 'CHART_DONUT', name: '도넛형 차트', description: 'Donut Chart', icon: 'icon/ct-donut.svg' },
  BOARD_NUMERIC: { type: 'BOARD_NUMERIC', name: '숫자판', description: 'Score Board', icon: 'icon/ct-score.svg' },
  BOARD_TABLE: { type: 'BOARD_TABLE', name: '표', description: 'Data Grid', icon: 'icon/ct-data.svg' },
  CHART_STACKED_LINE: {
    type: 'CHART_STACKED_LINE',
    name: '누적 선형 차트',
    description: 'Stacked Line Chart',
    icon: 'icon/ct-stacked-line.svg',
  },
  CHART_STACKED_AREA: {
    type: 'CHART_STACKED_AREA',
    name: '누적 영역형 차트',
    description: 'Stacked Area Chart',
    icon: 'icon/ct-stacked-area.svg',
  },
  CHART_STACKED_COLUMN: {
    type: 'CHART_STACKED_COLUMN',
    name: '누적 가로 막대형 차트',
    description: 'Stacked Column Chart',
    icon: 'icon/ct-stacked-column.svg',
  },
  CHART_STACKED_BAR: {
    type: 'CHART_STACKED_BAR',
    name: '누적 세로 막대형 차트',
    description: 'Stacked Bar Chart',
    icon: 'icon/ct-stacked-bar.svg',
  },
  CHART_TREEMAP: { type: 'CHART_TREEMAP', name: '트리맵 차트', description: 'Treemap Chart', icon: 'icon/ct-treemap.svg' },
  CHART_CANDLESTICK: {
    type: 'CHART_CANDLESTICK',
    name: '캔들스틱 차트',
    description: 'Candlestick Chart',
    icon: 'icon/ct-candle.svg',
  },
  CHART_GAUGE: { type: 'CHART_GAUGE', name: '계기판 차트', description: 'Gauge Chart', icon: 'icon/ct-gauge.svg' },
  CHART_SUNBURST: {
    type: 'CHART_SUNBURST',
    name: '선버스트 차트',
    description: 'Sunburst Chart',
    icon: 'icon/ct-sunburst.svg',
  },
  CHART_HEATMAP: { type: 'CHART_HEATMAP', name: '히트맵 차트', description: 'Heatmap Chart', icon: 'icon/ct-heatmap.svg' },
  CHART_FUNNEL: { type: 'CHART_FUNNEL', name: '깔때기형 차트', description: 'Funnel Chart', icon: 'icon/ct-funnel.svg' },
  CHART_3D_BAR: { type: 'CHART_3D_BAR', name: '3D 막대형 차트', description: '3D Bar Chart' },
  CHART_3D_LINE: { type: 'CHART_3D_LINE', name: '3D 선형 차트', description: '3D Line Chart' },
  CHART_3D_SCATTER: { type: 'CHART_3D_SCATTER', name: '3D 분산형 차트', description: '3D Scatter Chart' },
  CHART_3D_BUBBLE: { type: 'CHART_3D_BUBBLE', name: '3D 거품형 차트', description: '3D Bubble Chart' },
  CHART_WATERFALL_BAR: { type: 'CHART_WATERFALL_BAR', name: '폭포수 세로 차트', description: 'Waterfall Bar Chart' },
  CHART_WATERFALL_COLUMN: {
    type: 'CHART_WATERFALL_COLUMN',
    name: '폭포수 가로 차트',
    description: 'Waterfall Column Chart',
  },
  CHART_POLAR_BAR: { type: 'CHART_POLAR_BAR', name: '극좌표 막대형 차트', description: 'Polar Bar Chart' },
  MIXED_CHART_LINE_PIE: {
    type: 'MIXED_CHART_LINE_PIE',
    name: '선형과 원형 복합 차트',
    description: 'Mixed Line and Pie Chart',
  },
  CHART_POLAR_STACKED_BAR: {
    type: 'CHART_POLAR_STACKED_BAR',
    name: '극좌표 누적 막대형 차트',
    description: 'Polar Stacked Bar Chart',
  },
  MIXED_CHART_AREA_PIE: {
    type: 'MIXED_CHART_AREA_PIE',
    name: '영역형과 원형 복합 차트',
    description: 'Mixed Area and Pie Chart',
  },
  MIXED_CHART_BAR_PIE: {
    type: 'MIXED_CHART_BAR_PIE',
    name: '세로 막대형과 원형 복합 차트',
    description: 'Mixed Bar and Pie Chart',
  },
  MIXED_CHART_COLUMN_PIE: {
    type: 'MIXED_CHART_COLUMN_PIE',
    name: '가로 막대형과 원형 복합 차트',
    description: 'Mixed Column and Pie Chart',
  },
  MIXED_CHART_STACKED_BAR_PIE: {
    type: 'MIXED_CHART_STACKED_BAR_PIE',
    name: '누적 세로 막대형과 원형 복합 차트',
    description: 'Mixed Stacked-Bar and Pie Chart',
  },
  MIXED_CHART_STACKED_COLUMN_PIE: {
    type: 'MIXED_CHART_STACKED_COLUMN_PIE',
    name: '누적 가로 막대형과 원형 복합 차트',
    description: 'Mixed Stacked-Column and Pie Chart',
  },
  MIXED_CHART_STACKED_LINE_PIE: {
    type: 'MIXED_CHART_STACKED_LINE_PIE',
    name: '누적 선형과 원형 복합 차트',
    description: 'Mixed Stacked-Line and Pie Chart',
  },
  MIXED_CHART_STACKED_AREA_PIE: {
    type: 'MIXED_CHART_STACKED_AREA_PIE',
    name: '누적 영역형과 원형 복합 차트',
    description: 'Mixed Stacked-Area and Pie Chart',
  },
  MIXED_CHART_DONUT_PIE: {
    type: 'MIXED_CHART_DONUT_PIE',
    name: '도넛형과 원형 복합 차트',
    description: 'Mixed Donut and Pie Chart',
  },
  MIXED_CHART_NIGHTINGALE_PIE: {
    type: 'MIXED_CHART_NIGHTINGALE_PIE',
    name: '나이팅게일과 원형 복합 차트',
    description: 'Mixed Nightingale and Pie Chart',
  },
  MIXED_CHART_LINE_STACKED_BAR: {
    type: 'MIXED_CHART_LINE_STACKED_BAR',
    name: '선형과 누적 세로 막대형 복합 차트',
    description: 'Mixed Line and Stacked-Bar Chart',
  },
  MIXED_CHART_LINE_BOARD_NUMERIC: {
    type: 'MIXED_CHART_LINE_BOARD_NUMERIC',
    name: '선형 차트와 숫자 보드',
    description: 'Line Chart and Score Board',
  },
  MIXED_CHART_AREA_BOARD_NUMERIC: {
    type: 'MIXED_CHART_AREA_BOARD_NUMERIC',
    name: '영역형 차트와 숫자 보드',
    description: 'Area Chart and Score Board',
  },
  MIXED_CHART_BAR_BOARD_NUMERIC: {
    type: 'MIXED_CHART_BAR_BOARD_NUMERIC',
    name: '세로 막대형 차트와 숫자 보드',
    description: 'Bar Chart and Score Board',
  },
  MIXED_CHART_COLUMN_BOARD_NUMERIC: {
    type: 'MIXED_CHART_COLUMN_BOARD_NUMERIC',
    name: '가로 막대형 차트와 숫자 보드',
    description: 'Column Chart and Score Board',
  },
  MIXED_CHART_STACKED_LINE_BOARD_NUMERIC: {
    type: 'MIXED_CHART_STACKED_LINE_BOARD_NUMERIC',
    name: '누적 선형 차트와 숫자 보드',
    description: 'Stacked Line Chart and Score Board',
  },
  MIXED_CHART_STACKED_AREA_BOARD_NUMERIC: {
    type: 'MIXED_CHART_STACKED_AREA_BOARD_NUMERIC',
    name: '누적 영역형 차트와 숫자 보드',
    description: 'Stacked Area Chart and Score Board',
  },
  MIXED_CHART_STACKED_BAR_BOARD_NUMERIC: {
    type: 'MIXED_CHART_STACKED_BAR_BOARD_NUMERIC',
    name: '누적 세로 막대형 차트와 숫자 보드',
    description: 'Stacked Bar Chart and Score Board',
  },
  MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC: {
    type: 'MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC',
    name: '누적 가로 막대형 차트와 숫자 보드',
    description: 'Stacked Column Chart and Score Board',
  },
  MIXED_CHART_DONUT_BOARD_NUMERIC: {
    type: 'MIXED_CHART_DONUT_BOARD_NUMERIC',
    name: '도넛형 차트와 숫자 보드',
    description: 'Donut Chart and Score Board',
  },
  MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC: {
    type: 'MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC',
    name: '나이팅게일 차트와 숫자 보드',
    description: 'Nightingale Chart and Score Board',
  },
};

export const WIDGET_AGGREGATION = {
  SUM: 'sum',
  AVG: 'avg',
  MAX: 'max',
  MIN: 'min',
};

export const TABLE_ALIGN = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
};

export const AGGREGATION_LIST = [
  { label: '합계', value: WIDGET_AGGREGATION.SUM },
  { label: '평균', value: WIDGET_AGGREGATION.AVG },
  { label: '최대', value: WIDGET_AGGREGATION.MAX },
  { label: '최소', value: WIDGET_AGGREGATION.MIN },
];

export const LABEL_LIST = [{ label: '표시', value: true }];

export const PIE_LABEL_LIST = [
  { label: '이름', value: '{b}' },
  { label: '값', value: '{c}' },
  { label: '퍼센트', value: '{d}' + ' %' },
];

export const ALIGN_LIST = [
  { label: 'Left', value: TABLE_ALIGN.LEFT },
  { label: 'Center', value: TABLE_ALIGN.CENTER },
  { label: 'Right', value: TABLE_ALIGN.RIGHT },
];

export const COLUMN_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
};

export const LEGEND_LIST = [
  { label: '위쪽', value: 'top' },
  { label: '왼쪽', value: 'left' },
  { label: '오른쪽', value: 'right' },
  { label: '아래쪽', value: 'bottom' },
];

export const STATUS = {
  SUCCESS: 'SUCCESS',
};
