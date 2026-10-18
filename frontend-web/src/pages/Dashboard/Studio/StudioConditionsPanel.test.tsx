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

const semanticScope = {
  schemaVersion: 1 as const,
  catalogVersion: 3,
  columns: [{ column: 'amount', businessType: 'category' as const, dateFormat: '' as const }],
};
const categoryColumns = [
  { name: 'amount', type: 'BIGINT', kind: 'number' as const, businessType: 'category' as const, dateFormat: '' as const },
];
it('imports source semantics explicitly but schema reads preserve the current edited wrapper instead of Source entry context', async () => {
  const onApply = vi.fn();
  const local = {
    ...conditions,
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'eq', values: [10] }, exclude: null },
    semantics: semanticScope,
  };
  const source = {
    ...reply().data.data,
    definition: { ...local.definition, include: { ...local.definition.include, values: [20] } },
    semantics: { ...semanticScope, catalogVersion: 8 },
    columns: categoryColumns,
  };
  api.post.mockImplementation(async (_url, body) => ({
    data: {
      status: 'SUCCESS',
      data: body.analysisConditions
        ? { ...source, definition: body.analysisConditions.definition, semantics: body.analysisConditions.semantics }
        : source,
    },
  }));
  render(
    <StudioConditionsPanel
      sourceId={4}
      sourceRevision={hash}
      conditions={local}
      columns={categoryColumns}
      onApply={onApply}
    />,
  );
  open();
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '적용된 조건 검토' }));
  await screen.findByText(/소스 조건 버전 7/);
  expect(api.post.mock.lastCall?.[1].analysisConditions).toEqual({
    ...local,
    definition: { ...local.definition, include: { ...local.definition.include, values: [11] } },
  });
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('11');
  expect(screen.getByText(/업무 의미 카탈로그 버전 3/)).toBeTruthy();
  read();
  await screen.findByText(/업무 의미 카탈로그 버전 8/);
  expect(api.post.mock.lastCall?.[1]).toEqual({ sourceId: 4 });
  fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
  expect(onApply.mock.lastCall?.[0].semantics.catalogVersion).toBe(8);
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '21' } });
  fireEvent.click(screen.getByRole('button', { name: '적용된 조건 검토' }));
  await screen.findByText(/업무 의미 카탈로그 버전 8/);
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('21');
  expect(screen.queryByRole('option', { name: '초과', exact: true })).toBeNull();
});
it('explicit latest adoption preserves invalid local values and cannot silently discard semantics', async () => {
  const onApply = vi.fn();
  const local = {
    ...conditions,
    semantics: {
      ...semanticScope,
      columns: [{ column: 'amount', businessType: 'number' as const, dateFormat: '' as const }],
    },
  };
  render(
    <StudioConditionsPanel
      sourceId={4}
      sourceRevision={hash}
      conditions={local}
      columns={[{ name: 'amount', type: 'BIGINT', kind: 'number' }]}
      onApply={onApply}
    />,
  );
  open();
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '23' } });
  api.post.mockImplementation(async (_url, body) => ({
    data: {
      status: 'SUCCESS',
      data: {
        ...reply().data.data,
        definition: body.analysisConditions.definition,
        semantics: { ...semanticScope, catalogVersion: 4 },
        columns: categoryColumns,
      },
    },
  }));
  fireEvent.click(screen.getByRole('button', { name: '최신 업무 의미 채택' }));
  await screen.findByText(/업무 의미 카탈로그 버전 4/);
  expect(api.post).toHaveBeenLastCalledWith('/bi/source-conditions/read', {
    sourceId: 4,
    adoptCurrentSemantics: true,
    analysisConditions: {
      ...local,
      definition: { ...local.definition, include: { ...local.definition.include, values: [23] } },
    },
  });
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('23');
  fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
  await screen.findByRole('alert');
  expect(onApply).not.toHaveBeenCalled();
  api.post.mockResolvedValue(reply());
  read();
  await screen.findByRole('alert');
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('23');
  expect(screen.getByText(/업무 의미 카탈로그 버전 4/)).toBeTruthy();
});

it('accepts prepared latest semantics for a new condition scope, while later profile refreshes preserve edited values', () => {
  const onApply = vi.fn();
  const { rerender } = render(
    <StudioConditionsPanel
      sourceId={4}
      sourceRevision={hash}
      columns={categoryColumns}
      conditionSemantics={semanticScope}
      onApply={onApply}
    />,
  );
  open();
  fireEvent.click(screen.getByRole('button', { name: '포함 조건 추가' }));
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '42' } });
  rerender(
    <StudioConditionsPanel
      sourceId={4}
      sourceRevision={hash}
      columns={categoryColumns}
      conditionSemantics={semanticScope}
      onApply={onApply}
    />,
  );
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('42');
  fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
  expect(onApply.mock.lastCall?.[0].semantics).toEqual(semanticScope);
  expect(onApply.mock.lastCall?.[0].definition.include.values).toEqual([42]);
});

it('recovers missing local columns using the exact applied wrapper, never the unrelated source entry context', async () => {
  const onApply = vi.fn();
  const local = {
    ...conditions,
    semantics: semanticScope,
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'eq', values: [10] }, exclude: null },
  };
  api.post.mockResolvedValue({
    data: {
      status: 'SUCCESS',
      data: { ...reply().data.data, definition: local.definition, semantics: semanticScope, columns: categoryColumns },
    },
  });
  render(<StudioConditionsPanel sourceId={4} sourceRevision={hash} conditions={local} onApply={onApply} />);
  open();
  fireEvent.click(screen.getByRole('button', { name: '적용된 조건 검토' }));
  await screen.findByLabelText('포함 값 1');
  expect(api.post).toHaveBeenCalledWith('/bi/source-conditions/read', { sourceId: 4, analysisConditions: local });
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
  expect(onApply.mock.lastCall?.[0].semantics).toEqual(semanticScope);
});

it('rejects schema replies from a different frozen Source context without replacing the edited draft or semantics', async () => {
  const onApply = vi.fn();
  const local = {
    ...conditions,
    semantics: semanticScope,
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'eq', values: [10] }, exclude: null },
  };
  render(
    <StudioConditionsPanel
      sourceId={4}
      sourceRevision={hash}
      conditions={local}
      columns={categoryColumns}
      onApply={onApply}
    />,
  );
  open();
  fireEvent.change(screen.getByLabelText('포함 값 1'), { target: { value: '99' } });
  api.post.mockResolvedValue({
    data: {
      status: 'SUCCESS',
      data: {
        ...reply().data.data,
        definition: local.definition,
        semantics: { ...semanticScope, catalogVersion: 9 },
        columns: categoryColumns,
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '적용된 조건 검토' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('99');
  expect(screen.getByText(/업무 의미 카탈로그 버전 3/)).toBeTruthy();
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '조건 명시 적용' }));
  expect(onApply.mock.lastCall?.[0].semantics).toEqual(semanticScope);
  expect(onApply.mock.lastCall?.[0].definition.include.values).toEqual([99]);
});
