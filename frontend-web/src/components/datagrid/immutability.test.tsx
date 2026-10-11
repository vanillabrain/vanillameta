import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DataGrid from './index';

const grid = vi.hoisted(() => ({ inputs: [] as any[], mutate: false }));

vi.mock('@mui/material', () => ({ Stack: ({ children }: any) => <div>{children}</div> }));
vi.mock('@toast-ui/react-grid', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props: any, ref) => {
      React.useImperativeHandle(ref, () => ({ getInstance: () => ({ refreshLayout: vi.fn() }) }));
      grid.inputs.push(props.data);
      if (grid.mutate && Array.isArray(props.data)) {
        props.data.forEach((row: any, index: number) => {
          row.rowKey = index;
          row.sortKey = index;
          row.uniqueKey = 'grid';
          row._attributes = row._attributes || {};
          row._attributes.checked = true;
          row._attributes.className = row._attributes.className || { row: [], column: {} };
          row._attributes.className.row.push('grid');
          row._attributes.className.column.amount = ['grid'];
          row._disabledPriority = {};
          row.rowSpanMap = {};
          row._relationListItemMap = {};
        });
      }
      return null;
    }),
  };
});

afterEach(() => {
  cleanup();
  grid.inputs = [];
  grid.mutate = false;
});

describe('DataGrid caller isolation', () => {
  it('isolates row objects and nested grid attributes from a mutating grid', () => {
    const data = [{ category: 'A', amount: 100, _attributes: { className: { row: ['user'], column: {} } } }];
    const original = JSON.parse(JSON.stringify(data));
    grid.mutate = true;
    render(<DataGrid data={data} columns={[]} />);
    expect(data).toEqual(original);
    expect(grid.inputs[0]).not.toBe(data);
    expect(grid.inputs[0][0]).not.toBe(data[0]);
  });

  it('memoizes a data reference and replaces it when caller rows change', () => {
    const first = [{ amount: 100 }];
    const second = [{ amount: 250 }];
    const view = render(<DataGrid data={first} columns={[]} />);
    const initial = grid.inputs[0];
    view.rerender(<DataGrid data={first} columns={[]} />);
    expect(grid.inputs[1]).toBe(initial);
    view.rerender(<DataGrid data={second} columns={[]} />);
    expect(grid.inputs[2]).not.toBe(initial);
    expect(grid.inputs[2]).not.toBe(second);
    expect(grid.inputs[2]).toEqual(second);
  });

  it('preserves non-array DataSource configuration identity', () => {
    const data: any = { api: { readData: { url: '/rows', method: 'GET' } } };
    render(<DataGrid data={data} columns={[]} />);
    expect(grid.inputs[0]).toBe(data);
  });
});
