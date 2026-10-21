import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConditionProfilePanel from './ConditionProfilePanel';
import { readConditionProfile } from './conditionProfile';
const columns = [{ name: 'channel', type: 'VARCHAR', kind: 'string' as const }];
const zero = { total: '0', matched: '0', excluded: '0', remaining: '0' };
const all = { total: '2', matched: '1', excluded: '0', remaining: '1' };
export const profileFixture = () => ({
  population: { ...all, matchedRatio: 0.5, remainingRatio: 0.5 },
  distributions: [
    {
      column: 'channel',
      type: 'VARCHAR',
      limit: 20,
      totalGroups: '2',
      hasMore: false,
      rows: [
        { value: 'A', valueTruncated: false, total: '1', matched: '1', excluded: '0', remaining: '1' },
        { value: 'B', valueTruncated: false, total: '1', matched: '0', excluded: '0', remaining: '0' },
      ],
      other: { ...zero },
      range: { minimum: 'A', maximum: 'B', minimumTruncated: false, maximumTruncated: false },
    },
  ],
  sample: {
    columns: [{ name: 'channel', type: 'VARCHAR' }],
    rows: [{ values: ['A'], truncated: [false] }],
    limit: 20,
    totalRows: '1',
    hasMore: false,
    selection: 'ordered',
    representative: false,
  },
});
const props = { columns, contextKey: 'scope1', scopeLabel: '현재 조건 · 전체 기간' };
afterEach(cleanup);
const choose = () => {
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 탐색' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'channel 분포·표본 선택' }));
};
it('requires explicit field selection/query and distinguishes full distributions from ordered sample', async () => {
  const load = vi.fn().mockResolvedValue(profileFixture());
  render(<ConditionProfilePanel {...props} load={load} />);
  expect(load).not.toHaveBeenCalled();
  choose();
  expect(load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  await screen.findByText(/현재 범위 전체 2행/);
  expect(load.mock.calls[0][0]).toEqual(['channel']);
  expect(load).toHaveBeenCalledTimes(1);
  expect(screen.getByText('정렬 표본 · 1/1행')).toBeTruthy();
  expect(screen.getByText(/무작위·대표표본이 아닙니다/)).toBeTruthy();
  expect(within(screen.getByRole('article', { name: 'channel 전체 분포' })).getAllByRole('row')).toHaveLength(3);
});
it('drops a late response when scope changes and retains input selection without automatic rerun', async () => {
  let finish: (v: unknown) => void = () => {
    throw new Error('profile promise not initialized');
  };
  const load = vi.fn().mockImplementation(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  const view = render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  view.rerender(<ConditionProfilePanel {...props} contextKey="scope2" load={load} />);
  await act(async () => {
    finish(profileFixture());
  });
  expect(screen.queryByText(/현재 범위 전체 2행/)).toBeNull();
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  expect(load).toHaveBeenCalledTimes(1);
});
it('rejects damaged or mismatched results and keeps checked fields on failure', async () => {
  const load = vi
    .fn()
    .mockResolvedValue({ ...profileFixture(), sample: { ...profileFixture().sample, representative: true } });
  render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  await screen.findByRole('alert');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByText(/현재 범위 전체 2행/)).toBeNull();
});
it('uses safe retry guidance instead of exposing transport or server diagnostics', async () => {
  const load = vi.fn().mockRejectedValue(new Error('Network Error: SQL password=secret'));
  render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('다시 조회');
  expect(alert.textContent).toContain('유지');
  expect(alert.textContent).not.toMatch(/Network Error|SQL|password|secret/);
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByText(/현재 범위 전체 2행/)).toBeNull();
});
it('retains the retry focus while busy, blocks duplicate reads and permits keyboard retry after failure', async () => {
  let reject: (reason: unknown) => void = () => undefined;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValueOnce(profileFixture());
  render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  const button = screen.getByRole('button', { name: '분포·표본 조회' }) as HTMLButtonElement;
  button.focus();
  fireEvent.click(button);
  expect(button.disabled).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(button.getAttribute('aria-busy')).toBe('true');
  fireEvent.click(button);
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Network Error')));
  await screen.findByRole('alert');
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-disabled')).toBe('false');
  fireEvent.click(button);
  await screen.findByText(/현재 범위 전체 2행/);
  expect(load).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(button);
});
it('invalidates results on field deselection and enforces the six-field limit/unsupported types', async () => {
  const cs = Array.from({ length: 7 }, (_, i) => ({ name: 'c' + i, type: 'VARCHAR', kind: 'string' as const }));
  cs.push({ name: 'blob', type: 'BLOB', kind: 'unsupported' as any });
  render(<ConditionProfilePanel {...props} columns={cs} load={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 탐색' }));
  for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('checkbox', { name: 'c' + i + ' 분포·표본 선택' }));
  expect((screen.getByRole('checkbox', { name: 'c6 분포·표본 선택' }) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole('checkbox', { name: 'blob 분포·표본 선택' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'c0 분포·표본 선택' }));
  expect((screen.getByRole('checkbox', { name: 'c6 분포·표본 선택' }) as HTMLInputElement).disabled).toBe(false);
});
it('validates population/other arithmetic, selected columns, limits and truncation flags', () => {
  for (const mutate of [
    (r: any) => (r.distributions[0].other.total = '1'),
    (r: any) => (r.sample.columns[0].name = 'secret'),
    (r: any) => (r.sample.rows[0].truncated = []),
    (r: any) => (r.population.remaining = '3'),
    (r: any) => (r.sample.limit = 50),
  ]) {
    const r = profileFixture();
    mutate(r);
    expect(() => readConditionProfile(r, ['channel'], columns)).toThrow();
  }
});

it('does not resurrect an earlier result after deselecting and reselecting the same field', async () => {
  const load = vi.fn().mockResolvedValue(profileFixture());
  render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  await screen.findByText(/현재 범위 전체 2행/);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.queryByText(/현재 범위 전체 2행/)).toBeNull();
  expect(load).toHaveBeenCalledTimes(1);
});

it.each([false, true])('distinguishes an empty population from filtered-out rows: empty=%s', async empty => {
  const value = profileFixture();
  value.population = {
    total: empty ? '0' : '2',
    matched: '0',
    excluded: '0',
    remaining: '0',
    matchedRatio: empty ? null : 0,
    remainingRatio: empty ? null : 0,
  };
  value.distributions[0].rows = empty
    ? []
    : value.distributions[0].rows.map(row => ({ ...row, matched: '0', remaining: '0' }));
  if (empty) {
    value.distributions[0].totalGroups = '0';
    value.distributions[0].range.minimum = null;
    value.distributions[0].range.maximum = null;
  }
  value.sample.rows = [];
  value.sample.totalRows = '0';
  const load = vi.fn().mockResolvedValue(value);
  render(<ConditionProfilePanel {...props} load={load} />);
  choose();
  fireEvent.click(screen.getByRole('button', { name: '분포·표본 조회' }));
  const message = empty
    ? '현재 범위에 데이터가 없습니다. 원본 데이터·기간·필터를 확인하세요.'
    : '조건을 만족하는 행이 없습니다. 포함·제외 조건을 확인하세요.';
  expect(await screen.findByText(message)).toBeTruthy();
  const distribution = screen.getByRole('article', { name: 'channel 전체 분포' });
  if (empty) {
    expect(distribution.textContent).toContain('현재 범위에 값 그룹이 없습니다.');
    expect(distribution.textContent).not.toContain('값 없음 (NULL)');
  } else {
    expect(distribution.textContent).toContain('NULL 포함 2그룹');
  }
  expect(load).toHaveBeenCalledTimes(1);
});
