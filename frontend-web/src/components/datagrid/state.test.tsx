import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DataGrid, { compareGridValues } from './index';

const columns = [{ name: 'amount', header: 'amount', sortable: true }];

const renderGrid = (props: any = {}) => {
  const ref = React.createRef<any>();
  render(<DataGrid ref={ref} columns={columns} {...props} />);
  return { ref };
};

const cellTexts = () => Array.from(document.querySelectorAll('[data-slot="datagrid-cell"]')).map(node => node.textContent);

afterEach(cleanup);

describe('DataGrid row identity', () => {
  it('keeps a selected record after sorting reorders rows', () => {
    const data = [{ amount: 250, _attributes: { checked: true } }, { amount: 100 }];
    const { ref } = renderGrid({ data, checkable: true });
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([250]);
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(cellTexts()).toEqual(['100', '250']);
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([250]);
    expect(document.querySelector('[data-row-key="0"]').textContent).toContain('250');
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(ref.current.getCheckedRows()).toEqual([]);
    expect(data[0]._attributes.checked).toBe(true);
  });

  it('keeps selection tied to a caller rowKey through sorting', () => {
    const data = [
      { rowKey: 'b', amount: 250, _attributes: { checked: true } },
      { rowKey: 'a', amount: 100 },
    ];
    const { ref } = renderGrid({ data, checkable: true });
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(Array.from(document.querySelectorAll('[data-row-key]')).map(node => node.getAttribute('data-row-key'))).toEqual([
      'a',
      'b',
    ]);
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([250]);
  });
});

describe('DataGrid comparator', () => {
  it('sorts zeros numerically and keeps blanks first ascending', () => {
    const data = [{ amount: 5 }, { amount: null }, { amount: 0 }, { amount: '' }];
    renderGrid({ data });
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(cellTexts()).toEqual(['', '', '0', '5']);
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(cellTexts()).toEqual(['5', '0', '', '']);
  });

  it('compares numeric strings numerically and treats zero as a value', () => {
    expect(compareGridValues('10', '9')).toBeGreaterThan(0);
    expect(compareGridValues(0, '')).toBeGreaterThan(0);
    expect(compareGridValues(null, 1)).toBeLessThan(0);
    expect(compareGridValues(5, 5)).toBe(0);
  });
});

describe('DataGrid initial selection', () => {
  it('keeps the source index of a pre-checked row that is not first', () => {
    const data = [{ amount: 100 }, { amount: 250, _attributes: { checked: true } }];
    const { ref } = renderGrid({ data, checkable: true });
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([250]);
    expect(document.querySelector('[data-row-key="1"] [data-slot="datagrid-cell"]').textContent).toBe('250');
  });
});
