import { expect, it } from 'vitest';
import { pivotCsv } from './pivotCsv';
import type { PivotResult } from './PivotTable';
it('exports exact decimal strings, negative numbers, escaped labels, missing cells and explicit limited totals', () => {
  const data: PivotResult = {
    sourceRevision: 'rev',
    metrics: [{ id: 1, label: '=SUM(1)', decimalPlaces: 0, numberNotation: 'compact' }],
    rows: [
      {
        key: 'r',
        values: ['a,"b\n'],
        totals: ['9007199254740993.125'],
        cells: [{ columnKey: 'c', values: ['-0.000000123456789'] }],
      },
    ],
    columns: [
      { key: 'c', values: ['App'], totals: ['9007199254740993.125'] },
      { key: 'missing', values: [null], totals: [null] },
    ],
    grandTotals: ['9007199254740993.125'],
    limits: {
      rowLimit: 50,
      columnLimit: 12,
      totalRowGroups: 51,
      totalColumnGroups: 2,
      truncatedRows: true,
      truncatedColumns: false,
    },
  };
  const csv = pivotCsv(data, { rowDimensions: ['device'], columnDimensions: ['app'] });
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('"9007199254740993.125"');
  expect(csv).toContain('"-0.000000123456789"');
  expect(csv).toContain('"\'=SUM(1)"');
  expect(csv).toContain('"a,""b\n"');
  expect(csv).toContain('"","missing"');
  expect(csv).toContain('displayed_groups_only;totals_include_hidden_groups');
  expect(csv).not.toContain('9.0M');
});
