/** Reuse the standard widgets for server-validated analysis results. */
export function analysisOptions(widget: any) {
  if (widget.type === 'BOARD_NUMERIC') {
    return {
      header: { title: widget.valueField, fontSize: 13, color: '#586579' },
      content: {
        field: widget.valueField,
        aggregation: 'sum',
        fontSize: 42,
        color: '#14243c',
        prefix: widget.prefix || '',
        suffix: '',
        numForm: true,
        decimalPlaces: widget.decimalPlaces ?? 0,
      },
    };
  }
  const axis = widget.type === 'CHART_COLUMN' ? 'yField' : 'xField';
  return {
    [axis]: widget.categoryField,
    series: [{ field: widget.valueField, fieldLabel: widget.valueField, aggregation: 'sum', color: '#2563eb' }],
    label: false,
    mark: false,
    legendPosition: 'none',
  };
}
