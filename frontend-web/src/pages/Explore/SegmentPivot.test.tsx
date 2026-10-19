import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SegmentPivot from './SegmentPivot';
afterEach(cleanup);
it('supports explicit horizontal keyboard navigation without intercepting modified keys', () => {
  const result: any = {
    scope: { dimensionColumn: 'company' },
    kpis: [{ id: 1, label: 'Sales', value: 5 }],
    groups: [{ category: 'A', values: [{ id: 1, value: 5 }] }],
    pivot: {
      column: 'component',
      columns: [{ value: 'Compute', totals: [{ id: 1, value: 5 }] }],
      rows: [{ category: 'A', cells: [{ column: 'Compute', values: [{ id: 1, value: 5 }] }] }],
      columnLimit: 20,
      truncatedColumns: false,
    },
  };
  render(<SegmentPivot result={result} metricText={(_, v) => String(v)} />);
  const region = screen.getByRole('region', { name: '집계 조건 Pivot 표' });
  Object.defineProperties(region, { clientWidth: { value: 320 }, scrollWidth: { value: 640 } });
  region.focus();
  fireEvent.keyDown(region, { key: 'End' });
  expect(region.scrollLeft).toBe(320);
  fireEvent.keyDown(region, { key: 'ArrowLeft' });
  expect(region.scrollLeft).toBeLessThan(320);
  const previous = region.scrollLeft;
  fireEvent.keyDown(region, { key: 'ArrowLeft', altKey: true });
  expect(region.scrollLeft).toBe(previous);
  fireEvent.keyDown(region, { key: 'Home' });
  expect(region.scrollLeft).toBe(0);
});

it('uses real buttons for cell/row/column/grand drills and preserves null axis identity', () => {
  const choose = vi.fn();
  const result: any = {
    scope: { dimensionColumn: 'company' },
    kpis: [{ id: 1, label: 'Sales', value: 5 }],
    groups: [{ category: null, values: [{ id: 1, value: 5 }] }],
    pivot: {
      column: 'component',
      columns: [{ value: 'null', totals: [{ id: 1, value: 5 }] }],
      rows: [{ category: null, cells: [{ column: 'null', values: [{ id: 1, value: 5 }] }] }],
      columnLimit: 20,
    },
  };
  render(<SegmentPivot result={result} metricText={(_, v) => String(v)} onSelect={choose} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(4);
  fireEvent.click(buttons[0]);
  expect(choose.mock.calls[0][0]).toEqual({ row: null, column: 'null' });
  fireEvent.click(buttons[1]);
  expect(choose.mock.calls[1][0]).toEqual({ row: null });
  fireEvent.click(buttons[2]);
  expect(choose.mock.calls[2][0]).toEqual({ column: 'null' });
  fireEvent.click(buttons[3]);
  expect(choose.mock.calls[3][0]).toEqual({});
});
it('keeps the aggregate table and truncation warning outside collapsed help in compact blocks', () => {
  const result: any = {
    scope: { dimensionColumn: 'customer' },
    kpis: [{ id: 1, label: 'Sales', value: 5 }],
    groups: [{ category: 'A', values: [{ id: 1, value: 5 }] }],
    groupsTruncated: true,
    pivot: { column: 'service', columns: [], rows: [], columnLimit: 20, truncatedColumns: true },
  };
  const { container } = render(
    <SegmentPivot
      embedded
      compactHelp
      result={result}
      metricText={(_, v) => String(v)}
      helpContext={<p>저장 기간 전체 기간</p>}
    />,
  );
  const details = container.querySelector('details');
  expect(details).not.toBeNull();
  expect(details.open).toBe(false);
  expect(details.textContent).toContain('저장 기간 전체 기간');
  expect(details.textContent).toContain('Home/End');
  expect(screen.getByRole('table').closest('details')).toBeNull();
  expect(screen.getByText(/일부 대상·열 생략/).closest('details')).toBeNull();
});
