import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublishedDashboard from './PublishedDashboard';
const api = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ token: 'a'.repeat(64) }) }));
vi.mock('@/components/PageViewBox', () => ({ useMinWidth: () => false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }) }));
vi.mock('./studioPublication', async () => ({
  ...(await vi.importActual<any>('./studioPublication')),
  fetchPublished: api.read,
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
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
