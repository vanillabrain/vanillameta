export const WIDGET_TYPE = {
  BOARD_NUMERIC: 'BOARD_NUMERIC',
  BOARD_TABLE: 'BOARD_TABLE',
  CHART_LINE: 'CHART_LINE',
  CHART_STACKED_LINE: 'CHART_STACKED_LINE',
  CHART_AREA: 'CHART_AREA',
  CHART_STACKED_AREA: 'CHART_STACKED_AREA',
  CHART_BAR: 'CHART_BAR',
  CHART_STACKED_BAR: 'CHART_STACKED_BAR',
  CHART_COLUMN: 'CHART_COLUMN',
  CHART_STACKED_COLUMN: 'CHART_STACKED_COLUMN',
  CHART_PIE: 'CHART_PIE',
  CHART_DONUT: 'CHART_DONUT',
  CHART_NIGHTINGALE: 'CHART_NIGHTINGALE',
  CHART_MIXED_LINE_BAR: 'CHART_MIXED_LINE_BAR',
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

export const ALIGN_LIST = [
  { label: 'Left', value: TABLE_ALIGN.LEFT },
  { label: 'Center', value: TABLE_ALIGN.CENTER },
  { label: 'Right', value: TABLE_ALIGN.RIGHT },
];

export const COLUMN_TYPE = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
};
