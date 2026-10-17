import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceCatalogUsage from './SourceCatalogUsage';
import { post } from '@/helpers/apiHelper';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
afterEach(cleanup);
const response = (data: any) => ({
  data: { status: 'SUCCESS', data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '이 소스의 사용처 확인' }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(
    response({ sourceId: 3, kind: 'metrics', entries: [{ id: 1, title: '매출' }], nextAfterId: null }),
  );
});
it('starts collapsed and only reads source usage on explicit opening', async () => {
  render(<SourceCatalogUsage sourceId={3} />);
  expect(post).not.toHaveBeenCalled();
  open();
  await screen.findByText('매출');
  expect(post).toHaveBeenCalledWith('/bi/source-catalog/usage', { sourceId: 3, kind: 'metrics' });
  expect(screen.queryByRole('link')).toBeNull();
});
it('keeps scanning an empty candidate page and opens allowed analyses in a new tab', async () => {
  render(<SourceCatalogUsage sourceId={3} />);
  open();
  await screen.findByText('매출');
  vi.mocked(post).mockResolvedValueOnce(response({ sourceId: 3, kind: 'analyses', entries: [], nextAfterId: 20 }));
  fireEvent.change(screen.getByLabelText('사용처 유형'), { target: { value: 'analyses' } });
  await screen.findByText('현재까지 확인된 사용처가 없습니다.');
  expect(screen.getByText(/아직 확인할 목록/)).toBeTruthy();
  vi.mocked(post).mockResolvedValueOnce(
    response({ sourceId: 3, kind: 'analyses', entries: [{ id: 21, title: '매출 분석' }], nextAfterId: null }),
  );
  fireEvent.click(screen.getByRole('button', { name: '사용처 더 확인' }));
  const link = await screen.findByRole('link', { name: '매출 분석 열기' });
  expect(link.getAttribute('href')).toBe('/dashboard/21');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/usage', { sourceId: 3, kind: 'analyses', afterId: 20 });
});
it('retries a failed page without skipping it or creating writes', async () => {
  vi.mocked(post).mockRejectedValueOnce(new Error('offline'));
  render(<SourceCatalogUsage sourceId={3} />);
  open();
  await screen.findByText('사용처를 확인하지 못했습니다. 현재 편집 내용은 유지됩니다.');
  fireEvent.click(screen.getByRole('button', { name: '사용처 조회 다시 시도' }));
  await screen.findByText('매출');
  expect(vi.mocked(post).mock.calls.every(([url]) => url === '/bi/source-catalog/usage')).toBe(true);
});
it('does not show a delayed result after changing source', async () => {
  let finish: (value: any) => void;
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<SourceCatalogUsage sourceId={3} />);
  open();
  view.rerender(<SourceCatalogUsage sourceId={4} />);
  finish(response({ sourceId: 3, kind: 'metrics', entries: [{ id: 1, title: '낡은 응답' }], nextAfterId: null }));
  await waitFor(() => expect(screen.queryByText('낡은 응답')).toBeNull());
  expect(screen.getByRole('button', { name: '이 소스의 사용처 확인' }).getAttribute('aria-expanded')).toBe('false');
});

it('clears previously loaded usage after permission is denied on refresh', async () => {
  render(<SourceCatalogUsage sourceId={3} />);
  open();
  await screen.findByText('매출');
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 조회' }));
  await screen.findByText('사용처를 확인하지 못했습니다. 현재 편집 내용은 유지됩니다.');
  expect(screen.queryByText('매출')).toBeNull();
});

it('keeps the selected kind when an older kind response finishes late', async () => {
  let finish: (value: any) => void;
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  render(<SourceCatalogUsage sourceId={3} />);
  open();
  vi.mocked(post).mockResolvedValueOnce(
    response({ sourceId: 3, kind: 'analyses', entries: [{ id: 8, title: '현재 분석' }], nextAfterId: null }),
  );
  fireEvent.change(screen.getByLabelText('사용처 유형'), { target: { value: 'analyses' } });
  await screen.findByRole('link', { name: '현재 분석 열기' });
  finish(response({ sourceId: 3, kind: 'metrics', entries: [{ id: 9, title: '낡은 지표' }], nextAfterId: null }));
  await waitFor(() => expect(screen.queryByText('낡은 지표')).toBeNull());
  expect((screen.getByLabelText('사용처 유형') as HTMLSelectElement).value).toBe('analyses');
});
it('retries the failed older page with the same cursor while retaining confirmed entries', async () => {
  vi.mocked(post).mockResolvedValueOnce(
    response({ sourceId: 3, kind: 'metrics', entries: [{ id: 1, title: '첫 지표' }], nextAfterId: 1 }),
  );
  render(<SourceCatalogUsage sourceId={3} />);
  open();
  await screen.findByText('첫 지표');
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: '사용처 더 확인' }));
  await screen.findByText('사용처를 확인하지 못했습니다. 현재 편집 내용은 유지됩니다.');
  expect(screen.getByText('첫 지표')).toBeTruthy();
  vi.mocked(post).mockResolvedValueOnce(
    response({ sourceId: 3, kind: 'metrics', entries: [{ id: 2, title: '다음 지표' }], nextAfterId: null }),
  );
  fireEvent.click(screen.getByRole('button', { name: '사용처 조회 다시 시도' }));
  await screen.findByText('다음 지표');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/usage', { sourceId: 3, kind: 'metrics', afterId: 1 });
});

it.each([0, '20'])(
  'rejects an invalid continuation instead of presenting an incomplete result as finished: %j',
  async nextAfterId => {
    vi.mocked(post).mockResolvedValueOnce(
      response({ sourceId: 3, kind: 'metrics', entries: [{ id: 1, title: '확인되지 않은 목록' }], nextAfterId }),
    );
    render(<SourceCatalogUsage sourceId={3} />);
    open();
    await screen.findByText('사용처를 확인하지 못했습니다. 현재 편집 내용은 유지됩니다.');
    expect(screen.queryByText('확인되지 않은 목록')).toBeNull();
    expect(screen.queryByRole('button', { name: '사용처 더 확인' })).toBeNull();
  },
);
