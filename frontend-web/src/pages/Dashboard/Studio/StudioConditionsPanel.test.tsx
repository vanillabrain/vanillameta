import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StudioConditionsPanel from './StudioConditionsPanel';
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const hash = 'a'.repeat(64);
const definition = {
  include: { kind: 'predicate' as const, column: 'amount', operator: 'gt', values: [10] },
  exclude: null,
};
const conditions = { sourceRevision: hash, definition };
const reply = () => ({
  data: {
    status: 'SUCCESS',
    data: {
      sourceId: 4,
      sourceRevision: 'different-metadata-hash',
      version: 7,
      definition,
      columns: [{ name: 'amount', type: 'BIGINT', kind: 'number' }],
      schemaChanged: false,
    },
  },
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '포함·제외 조건' }));
const read = () => fireEvent.click(screen.getByRole('button', { name: '저장 조건 읽기' }));
describe('Studio explicit conditions review', () => {
  it('opening and reading do not apply; edited apply pins Studio file hash without source provenance', async () => {
    const onApply = vi.fn();
    api.post.mockResolvedValue(reply());
    render(<StudioConditionsPanel sourceId={4} sourceRevision={hash} onApply={onApply} />);
    open();
    expect(api.post).not.toHaveBeenCalled();
    read();
    await screen.findByText(/소스 조건 버전 7/);
    expect(api.post).toHaveBeenCalledWith('/bi/source-conditions/read', { sourceId: 4 });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
    expect(onApply).toHaveBeenCalledWith({
      sourceRevision: hash,
      definition: { ...definition, include: { ...definition.include, values: [20] } },
    });
  });
  it('clear is explicit null and Escape restores toggle focus', () => {
    const onApply = vi.fn();
    render(<StudioConditionsPanel sourceId={4} sourceRevision={hash} conditions={conditions} onApply={onApply} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: '조건 전체 해제' }));
    expect(onApply).toHaveBeenCalledWith(null);
    fireEvent.keyDown(screen.getByRole('region', { name: '포함·제외 조건' }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: '포함·제외 조건' })).toBe(document.activeElement);
  });
  it('read failures and schema409 preserve a reviewed edit and the applied scope', async () => {
    const onApply = vi.fn();
    api.post.mockResolvedValueOnce(reply()).mockRejectedValueOnce({ response: { status: 409 } });
    render(<StudioConditionsPanel sourceId={4} sourceRevision={hash} conditions={conditions} onApply={onApply} />);
    open();
    read();
    await screen.findByText(/소스 조건 버전 7/);
    fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '30' } });
    read();
    await screen.findByRole('alert');
    expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('30');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
    expect(onApply.mock.lastCall?.[0].definition.include.values).toEqual([30]);
  });
  it('ignores late reads after a source/file switch, unmount or permission lock', async () => {
    let resolve: (v: any) => void;
    api.post.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const onApply = vi.fn();
    const { rerender } = render(<StudioConditionsPanel sourceId={4} sourceRevision={hash} onApply={onApply} />);
    open();
    read();
    rerender(<StudioConditionsPanel sourceId={5} sourceRevision={'b'.repeat(64)} onApply={onApply} />);
    await act(async () => resolve(reply()));
    open();
    expect(screen.queryByText(/소스 조건 버전 7/)).toBeNull();
    read();
    rerender(<StudioConditionsPanel sourceId={5} sourceRevision={'b'.repeat(64)} disabled onApply={onApply} />);
    await act(async () => resolve(reply()));
    expect(screen.queryByText(/소스 조건 버전 7/)).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});
