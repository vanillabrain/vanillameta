import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DataGrid from './index';

const columns = [{ name: 'amount', header: 'amount', sortable: true }];

const renderGrid = (props: any = {}) => {
  const ref = React.createRef<any>();
  const view = render(<DataGrid ref={ref} columns={columns} {...props} />);
  return { ref, view };
};

afterEach(cleanup);

describe('DataGrid caller isolation', () => {
  it('isolates row objects and nested grid attributes from the rendered table', () => {
    const data: any[] = [{ amount: 100, _attributes: { className: { row: ['user'], column: {} } } }];
    const original = JSON.parse(JSON.stringify(data));
    const { ref } = renderGrid({ data });
    expect(data).toEqual(original);
    const rows = ref.current.getData();
    expect(rows).not.toBe(data);
    expect(rows[0]).not.toBe(data[0]);
    expect(rows[0]._attributes).not.toBe(data[0]._attributes);
    (rows[0]._attributes as any).checked = true;
    rows[0]._attributes.className.row.push('grid');
    expect(data[0]._attributes.checked).toBeUndefined();
    expect(data[0]._attributes.className.row).toEqual(['user']);
  });

  it('memoizes a data reference and replaces it when caller rows change', () => {
    const first = [{ amount: 100 }];
    const second = [{ amount: 250 }];
    const { ref, view } = renderGrid({ data: first });
    const initial = ref.current.getData();
    view.rerender(<DataGrid ref={ref} columns={columns} data={first} />);
    expect(ref.current.getData()).toBe(initial);
    view.rerender(<DataGrid ref={ref} columns={columns} data={second} />);
    expect(ref.current.getData()).not.toBe(initial);
    expect(ref.current.getData()).not.toBe(second);
    expect(ref.current.getData()).toEqual(second);
  });

  it('preserves non-array DataSource configuration identity', () => {
    const data: any = { api: { readData: { url: '/rows', method: 'GET' } } };
    const { ref } = renderGrid({ data });
    expect(ref.current.getData()).toBe(data);
  });

  it('renders an accessible table with stable row and column hooks', () => {
    const data = [
      { id: 1, amount: 100 },
      { id: 2, amount: 250 },
    ];
    renderGrid({ data });
    expect(document.querySelector('[data-slot="datagrid"]')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /^amount/ }).getAttribute('data-column-name')).toBe('amount');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(document.querySelectorAll('[data-row-key]')).toHaveLength(2);
    expect(
      document.querySelector('[data-row-key="0"] [data-column-name="amount"] [data-slot="datagrid-cell"]').textContent,
    ).toBe('100');
  });
});

describe('DataGrid interactions', () => {
  it('sorts through the column header without mutating caller data', () => {
    const data = [{ amount: 250 }, { amount: 100 }];
    renderGrid({ data });
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(Array.from(document.querySelectorAll('[data-slot="datagrid-cell"]')).map(node => node.textContent)).toEqual([
      '100',
      '250',
    ]);
    expect(data.map(row => row.amount)).toEqual([250, 100]);
    expect(screen.getByRole('columnheader', { name: /^amount/ }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    expect(Array.from(document.querySelectorAll('[data-slot="datagrid-cell"]')).map(node => node.textContent)).toEqual([
      '250',
      '100',
    ]);
    expect(screen.getByRole('columnheader', { name: /^amount/ }).getAttribute('aria-sort')).toBe('descending');
  });

  it('reports checked rows and keeps caller rows untouched', () => {
    const data = [{ amount: 100, _attributes: { checked: true } }, { amount: 250 }];
    const { ref } = renderGrid({ data, checkable: true });
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([100]);
    expect(ref.current.getRow(1).amount).toBe(250);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([100, 250]);
    expect(data[1]._attributes).toBeUndefined();
    expect(data[0]._attributes.checked).toBe(true);
  });

  it('resizes a column through the header handle and with the keyboard', () => {
    renderGrid({
      data: [{ amount: 100 }],
      columns: [{ name: 'amount', header: 'amount', width: 120 }],
      columnOptions: { resizable: true },
    });
    // The resize handle adds its own label to the header name, so match the column prefix.
    const header = screen.getByRole('columnheader', { name: /^amount/ });
    expect(header.style.width).toBe('120px');
    const handle = document.querySelector('[data-column-resize="amount"]');
    expect(handle).toBeTruthy();
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 160 });
    fireEvent.mouseUp(window);
    expect(header.style.width).toBe('180px');
    expect((screen.getByRole('table').querySelector('[data-column-name="amount"]') as HTMLElement).style.width).toBe(
      '180px',
    );
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(header.style.width).toBe('164px');
    for (let index = 0; index < 20; index += 1) {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    }
    expect(header.style.width).toBe('40px');
  });

  it('resizes by default and honors an explicit resizable:false', () => {
    const { view } = renderGrid({ data: [{ amount: 1 }] });
    expect(document.querySelector('[data-column-resize]')).not.toBeNull();
    view.unmount();
    renderGrid({ data: [{ amount: 1 }], columnOptions: { resizable: false } });
    expect(document.querySelector('[data-column-resize]')).toBeNull();
  });

  it('keeps the 100px minimum body height by default', () => {
    renderGrid({ data: [{ amount: 1 }] });
    expect((document.querySelector('[data-slot="datagrid"] > div') as HTMLElement).style.minHeight).toBe('100px');
  });

  it('keys rows and selection from the caller rowKey field', () => {
    const data = [{ rowKey: 7, amount: 100, _attributes: { checked: true } }];
    const { ref } = renderGrid({ data, checkable: true });
    expect(document.querySelector('[data-row-key="7"]')).toBeTruthy();
    expect(ref.current.getCheckedRows().map(row => row.amount)).toEqual([100]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(ref.current.getCheckedRows()).toEqual([]);
    expect(data[0]._attributes.checked).toBe(true);
  });
});
