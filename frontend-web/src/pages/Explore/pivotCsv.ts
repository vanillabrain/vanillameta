import type { PivotResult } from './PivotTable';
import type { PivotAxes } from './exploreViewState';
import { metricNumericText } from '@/utils/formatMetric';

export const pivotRequestKey = (request: unknown) => JSON.stringify(request);
// Quote every field and neutralize spreadsheet formulas only in textual labels.
const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
const label = (value: unknown) => {
  const text = value === null ? '(NULL)' : value === '' ? '(빈 문자열)' : String(value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
};
const numeric = (value: unknown) => (value === null ? '' : metricNumericText(value) ?? '');
/** Long-form CSV retains raw decimal strings, missing combinations and independent totals. */
export function pivotCsv(result: PivotResult, axes: PivotAxes): string {
  const scope =
    result.limits.truncatedRows || result.limits.truncatedColumns
      ? 'displayed_groups_only;totals_include_hidden_groups'
      : 'all_groups';
  const rows: string[][] = [
    [
      'record_type',
      'export_scope',
      'source_revision',
      ...axes.rowDimensions,
      ...axes.columnDimensions,
      'metric_id',
      'metric',
      'value',
      'combination',
    ],
  ];
  const add = (kind: string, row: unknown[], column: unknown[], values: unknown[], exists = true) => {
    result.metrics.forEach((metric, i) =>
      rows.push([
        kind,
        scope,
        label(result.sourceRevision),
        ...axes.rowDimensions.map((_, i) => (i < row.length ? label(row[i]) : '')),
        ...axes.columnDimensions.map((_, i) => (i < column.length ? label(column[i]) : '')),
        String(metric.id),
        label(metric.label),
        exists ? numeric(values[i]) : '',
        exists ? 'present' : 'missing',
      ]),
    );
  };
  add('grand_total', [], [], result.grandTotals);
  result.columns.forEach(col => add('column_total', [], col.values, col.totals));
  result.rows.forEach(row => {
    add('row_total', row.values, [], row.totals);
    result.columns.forEach(col => {
      const cell = row.cells.find(c => c.columnKey === col.key);
      add('cell', row.values, col.values, cell?.values ?? [], !!cell);
    });
  });
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
