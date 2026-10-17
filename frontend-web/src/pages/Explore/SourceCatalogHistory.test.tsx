import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { post } from '@/helpers/apiHelper';
import SourceCatalogHistory from './SourceCatalogHistory';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
afterEach(cleanup);
const response = (data: any) => ({
  data: { status: 'SUCCESS', data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const entries = [2, 1].map(version => ({
  version,
  label: `설명 ${version}`,
  createdAt: '2026-10-18T00:00:00.000Z',
  unreadable: false,
}));
const history = () => ({ sourceId: 3, entries, nextBeforeVersion: null });
const open = () => fireEvent.click(screen.getByRole('button', { name: '저장 이력·버전 비교' }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(history()));
});
it('loads only explicitly and compares selected saved versions without any save', async () => {
  render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  expect(post).not.toHaveBeenCalled();
  open();
  await screen.findByLabelText('이전 설명 버전');
  vi.mocked(post).mockResolvedValueOnce(
    response({
      sourceId: 3,
      fromVersion: 1,
      toVersion: 2,
      schemaChanged: false,
      dataChanged: false,
      changes: [{ column: 'amount', field: 'unit', before: '원', after: 'KRW' }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '선택한 버전 비교' }));
  await screen.findByText('KRW');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/compare', { sourceId: 3, fromVersion: 1, toVersion: 2 });
  expect(vi.mocked(post).mock.calls.every(([url]) => url !== '/bi/source-catalog/save')).toBe(true);
});
it('handles empty and one-version histories without a fake comparison', async () => {
  vi.mocked(post).mockResolvedValueOnce(response({ ...history(), entries: [] }));
  const view = render(<SourceCatalogHistory sourceId={3} savedVersion={0} />);
  open();
  await screen.findByText('아직 저장한 업무 설명이 없습니다.');
  view.unmount();
  vi.mocked(post).mockResolvedValueOnce(response({ ...history(), entries: entries.slice(0, 1) }));
  render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  open();
  await screen.findByText('비교하려면 정상 저장 버전이 두 개 이상 필요합니다.');
  expect(screen.queryByRole('button', { name: '선택한 버전 비교' })).toBeNull();
});
it('retries errors and clears an old comparison when selection changes', async () => {
  vi.mocked(post).mockRejectedValueOnce(new Error('offline'));
  render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  open();
  await screen.findByText('저장 이력을 불러오지 못했습니다. 입력은 유지됩니다.');
  vi.mocked(post).mockResolvedValueOnce(response(history()));
  fireEvent.click(screen.getByRole('button', { name: '이력 다시 읽기' }));
  await screen.findByLabelText('이전 설명 버전');
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '선택한 버전 비교' }));
  await screen.findByText('선택한 이력을 읽을 수 없습니다. 다른 버전을 선택하거나 담당자에게 확인해 주세요.');
  vi.mocked(post).mockResolvedValueOnce(
    response({ sourceId: 3, fromVersion: 1, toVersion: 2, changes: [], schemaChanged: true, dataChanged: true }),
  );
  fireEvent.click(screen.getByRole('button', { name: '선택한 버전 비교' }));
  await screen.findByText('두 버전의 업무 설명은 같습니다.');
  await screen.findByText(/원본 열 구조/);
  fireEvent.change(screen.getByLabelText('이전 설명 버전'), { target: { value: '2' } });
  expect(screen.queryByText('두 버전의 업무 설명은 같습니다.')).toBeNull();
  expect((screen.getByRole('button', { name: '선택한 버전 비교' }) as HTMLButtonElement).disabled).toBe(true);
});
it('loads older pages with the cursor and marks unreadable entries', async () => {
  vi.mocked(post).mockResolvedValueOnce(
    response({ ...history(), entries: [{ ...entries[0], unreadable: true, label: null }], nextBeforeVersion: 2 }),
  );
  render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  open();
  await screen.findByText(/읽을 수 없는 이력/);
  expect(screen.getByText('정상 버전이 부족합니다. 이전 이력을 더 읽어 비교할 버전을 찾아보세요.')).toBeTruthy();
  vi.mocked(post).mockResolvedValueOnce(response({ ...history(), entries: [entries[1]] }));
  fireEvent.click(screen.getByRole('button', { name: '이전 이력 더 보기' }));
  await screen.findByText(/· 설명 1/);
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/history', { sourceId: 3, beforeVersion: 2 });
});
it('resets the collapsed history when switching source during a read', async () => {
  let finish: (value: any) => void;
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  open();
  view.rerender(<SourceCatalogHistory sourceId={4} savedVersion={2} />);
  finish(response(history()));
  await waitFor(() => expect(screen.queryByLabelText('이전 설명 버전')).toBeNull());
  expect(screen.getByRole('button', { name: '저장 이력·버전 비교' }).getAttribute('aria-expanded')).toBe('false');
});

it('resets the history on a saved-version change while an old comparison is pending', async () => {
  let finish: (value: any) => void;
  const view = render(<SourceCatalogHistory sourceId={3} savedVersion={2} />);
  open();
  await screen.findByLabelText('이전 설명 버전');
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '선택한 버전 비교' }));
  view.rerender(<SourceCatalogHistory sourceId={3} savedVersion={3} />);
  finish(
    response({
      sourceId: 3,
      fromVersion: 1,
      toVersion: 2,
      changes: [{ column: null, field: 'label', before: 'old', after: 'stale result' }],
      schemaChanged: false,
      dataChanged: false,
    }),
  );
  await waitFor(() => expect(screen.queryByText('stale result')).toBeNull());
  expect(screen.getByRole('button', { name: '저장 이력·버전 비교' }).getAttribute('aria-expanded')).toBe('false');
});
