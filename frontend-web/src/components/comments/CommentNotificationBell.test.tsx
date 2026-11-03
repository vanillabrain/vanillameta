import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CommentNotificationBell, {
  CommentNotificationProvider,
  NOTIFICATION_POLL_MS,
  eventText,
} from './CommentNotificationBell';
import { NOTIFICATION_EVENTS } from './commentNotificationApi';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: uuid(n),
  reportId: uuid(100),
  threadId: uuid(200 + n),
  event: 'comment.replied',
  role: 'recipient',
  title: `보고서 ${n}`,
  actor: { kind: 'user', userId: 'owner', clientName: null },
  createdAt: '2026-11-03T00:00:00Z',
  read: false,
  ...overrides,
});
let unread = 2;
const page = {
  items: [item(1), item(2, { actor: { kind: 'ai', userId: null, clientName: 'Claude Code' }, read: true })],
  nextCursor: null,
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}
const show = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <CommentNotificationProvider>
        <CommentNotificationBell />
        <CommentNotificationBell />
      </CommentNotificationProvider>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  unread = 2;
  api.get.mockImplementation(async (url: string) =>
    url.endsWith('/unread-count') ? { data: { count: unread } } : { data: page },
  );
  api.post.mockResolvedValue({ data: { updated: 1 } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('shows the unread count, opens the list and goes to the thread in the reader', async () => {
  show();
  const bells = await screen.findAllByRole('button', { name: '댓글 알림, 읽지 않은 알림 2개' });
  expect(bells).toHaveLength(2);
  fireEvent.click(bells[0]);
  expect(await screen.findByText('보고서 1', { exact: false })).toBeTruthy();
  expect(screen.getByText('Claude · Claude Code')).toBeTruthy();
  expect(screen.getAllByText('읽지 않음')).toHaveLength(1);
  fireEvent.click(screen.getByText('보고서 1', { exact: false }).closest('button')!);
  expect(screen.getByTestId('where').textContent).toBe(`/reports/${uuid(100)}/read?thread=${uuid(201)}`);
  expect(api.post).toHaveBeenCalledWith('/comment-notifications/read', { ids: [uuid(1)] }, expect.anything());
  expect(screen.getAllByRole('button', { name: '댓글 알림, 읽지 않은 알림 1개' })).toHaveLength(2);
});

it('marks everything read and caps the badge at 99+', async () => {
  unread = 120;
  show();
  fireEvent.click((await screen.findAllByRole('button', { name: '댓글 알림, 읽지 않은 알림 99+개' }))[0]);
  fireEvent.click(await screen.findByRole('button', { name: '모두 읽음' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/comment-notifications/read', { all: true }, expect.anything()),
  );
  expect(await screen.findAllByRole('button', { name: '댓글 알림' })).toHaveLength(2);
  expect(screen.queryAllByText('읽지 않음')).toHaveLength(0);
});

it('polls once for every bell, every minute, and once when the user returns to the tab', async () => {
  vi.useFakeTimers();
  show();
  await act(() => Promise.resolve());
  const counts = () => api.get.mock.calls.filter(([url]) => String(url).endsWith('/unread-count')).length;
  expect(counts()).toBe(1);
  await act(async () => {
    vi.advanceTimersByTime(NOTIFICATION_POLL_MS);
  });
  expect(counts()).toBe(2);
  await act(async () => {
    vi.advanceTimersByTime(5_000);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(counts()).toBe(3);
  expect(api.get.mock.calls.some(([url]) => url === '/comment-notifications')).toBe(false);
});

it('describes every notification event with its own non-empty text', () => {
  const texts = NOTIFICATION_EVENTS.map(eventText);
  expect(texts.every(text => text.trim().length > 0)).toBe(true);
  expect(new Set(texts).size).toBe(NOTIFICATION_EVENTS.length);
});
