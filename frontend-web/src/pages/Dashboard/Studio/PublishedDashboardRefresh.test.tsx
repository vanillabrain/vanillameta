import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublishedDashboard from './PublishedDashboard';
import { pivotAggregate } from './studioPivot.fixture';
const api = vi.hoisted(() => ({ read: vi.fn(), token: 'a'.repeat(64) }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ token: api.token }) }));
vi.mock('@/components/PageViewBox', () => ({ useMinWidth: () => false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }) }));
vi.mock('./studioPublication', async () => ({
  ...(await vi.importActual<any>('./studioPublication')),
  fetchPublished: api.read,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.resetAllMocks();
  api.token = 'a'.repeat(64);
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});
it('retains the keyboard retry target while busy and after an expired response without duplicate reads', async () => {
  let reject!: (reason: unknown) => void;
  api.read.mockRejectedValueOnce({ response: { status: 410 } }).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(<PublishedDashboard />);
  await screen.findByRole('alert');
  const retry = screen.getByRole('button', { name: '다시 확인' }) as HTMLButtonElement;
  retry.focus();
  fireEvent.click(retry);
  await screen.findByRole('status');
  // A native disabled button loses focus in Chromium. Keep the target focusable,
  // communicate busy state, and decline repeated activation until the read ends.
  expect(retry.disabled).toBe(false);
  expect(retry.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(retry);
  fireEvent.click(retry);
  expect(api.read).toHaveBeenCalledTimes(2);
  await act(async () => reject({ response: { status: 410 } }));
  await screen.findByRole('alert');
  expect(retry.getAttribute('aria-disabled')).toBe('false');
  expect(document.activeElement).toBe(retry);
});

const published = (version = 1) => ({
  token: api.token,
  version,
  visibility: 'private',
  asOf: '2026-10-20T00:00:00Z',
  snapshot: {
    title: '게시 분석',
    periodLabel: '전체 기간',
    blocks: [
      {
        id: 'p1',
        kind: 'BOARD_NUMERIC',
        title: '매출',
        description: '',
        display: { suffix: ' USD' },
        valueField: 'value',
        fields: [{ columnName: 'value', columnType: 'number' }],
        datas: [{ value: 4000 }],
      },
    ],
    layouts: { xs: [{ id: 'p1', x: 0, y: 0, w: 1, h: 4 }] },
  },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<any>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const basisSummary = () => screen.getByText('기준 자세히 보기');

it('restores basis keyboard focus and disclosure after successful authority recheck while hiding old data', async () => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  const summary = await screen.findByText('기준 자세히 보기');
  summary.parentElement?.setAttribute('open', '');
  summary.focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  expect(screen.queryByText('게시 분석')).toBeNull();
  expect(screen.queryByText('4,000.00 USD')).toBeNull();
  await act(async () => pending.resolve(published()));
  expect(await screen.findByText('게시 분석')).toBeTruthy();
  expect(document.activeElement).toBe(basisSummary());
  expect(basisSummary().parentElement?.hasAttribute('open')).toBe(true);
  expect(api.read).toHaveBeenCalledTimes(2);
});

it('does not steal focus from the retry control selected during a recheck', async () => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  const retry = screen.getByRole('button', { name: '다시 확인' });
  retry.focus();
  await act(async () => pending.resolve(published()));
  await screen.findByText('게시 분석');
  expect(document.activeElement).toBe(retry);
});

it.each([403, 410, 503])('keeps old data hidden and offers safe retry focus after a %s response', async status => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  await act(async () => pending.reject({ response: { status } }));
  await screen.findByRole('alert');
  expect(screen.queryByText('게시 분석')).toBeNull();
  expect(screen.queryByText('4,000.00 USD')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '다시 확인' }));
});

it('does not reuse a content focus bookmark when the publication version changes', async () => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await act(async () => pending.resolve(published(2)));
  await screen.findByText('게시 분석');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '다시 확인' }));
});

it('restores the matching block control after overlapping focus and visibility rechecks', async () => {
  const slow = deferred(),
    latest = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(slow.promise).mockReturnValueOnce(latest.promise);
  render(<PublishedDashboard />);
  const card = await screen.findByRole('article', { name: '매출 게시 블록' });
  within(card).getByRole('button', { name: '집계 데이터 보기' }).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => latest.resolve(published()));
  await screen.findByText('게시 분석');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '집계 데이터 보기' }));
  await act(async () => slow.reject({ response: { status: 403 } }));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('restores a Pivot region by its block identity after authority revalidation', async () => {
  const pending = deferred(),
    value: any = published();
  value.snapshot.blocks.push({
    id: 'pivot1',
    kind: 'SEGMENT_PIVOT',
    title: '고객 Pivot',
    description: '',
    display: {},
    pivot: pivotAggregate(),
  });
  api.read.mockResolvedValueOnce(value).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  const region = await screen.findByRole('region', { name: '집계 조건 Pivot 표' });
  region.focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  expect(screen.queryByRole('region', { name: '집계 조건 Pivot 표' })).toBeNull();
  await act(async () => pending.resolve(value));
  expect(document.activeElement).toBe(await screen.findByRole('region', { name: '집계 조건 Pivot 표' }));
});

it('brings a restored control into view after removing old content collapses the page', async () => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  const scroll = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 1200, bottom: 1244 } as DOMRect);
  const view = render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  // The new target does not exist until the authorized response commits.
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    await act(async () => pending.resolve(published()));
    expect(document.activeElement).toBe(basisSummary());
    expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    view.unmount();
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

it.each(['Tab', 'pointer'])('does not restore an old target after new %s intent during a read', async intent => {
  const pending = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(pending.promise);
  render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  if (intent === 'Tab') fireEvent.keyDown(document.body, { key: 'Tab' });
  else fireEvent.pointerDown(document.body);
  await act(async () => pending.resolve(published()));
  await screen.findByText('게시 분석');
  expect(document.activeElement).toBe(document.body);
});

it('discards a previous-link bookmark and its late response on route changes', async () => {
  const old = deferred();
  api.read.mockResolvedValueOnce(published()).mockReturnValueOnce(old.promise);
  const view = render(<PublishedDashboard />);
  (await screen.findByText('기준 자세히 보기')).focus();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('status');
  api.token = 'b'.repeat(64);
  const other = published();
  other.snapshot.title = '다른 게시본';
  api.read.mockResolvedValueOnce(other);
  view.rerender(<PublishedDashboard />);
  await screen.findByText('다른 게시본');
  await act(async () => old.resolve(published()));
  expect(screen.queryByText('게시 분석')).toBeNull();
  expect(document.activeElement).toBe(document.body);
});
