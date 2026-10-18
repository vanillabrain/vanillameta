import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceLifecycle from './SourceLifecycle';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: api.patch, del: api.del }));

const raw = (data: unknown) => ({ data });
const status = (code: number) => ({ response: { status: code } });
const offline = () => new Error('Network Error');
const lifecycle = (sourceId: number, active: boolean, version: number) => ({ sourceId, active, version });

const openControl = () => fireEvent.click(screen.getByRole('button', { name: '활성 상태 관리 열기' }));
const stateRadio = (label: string) => screen.getByRole('radio', { name: label }) as HTMLInputElement;
const consentBox = () => screen.getByRole('checkbox', { name: /동의합니다/ }) as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: /^(활성 상태 저장|저장 중…)$/ }) as HTMLButtonElement;
const requeryButton = () => screen.getByRole('button', { name: '현재 상태 다시 읽기' }) as HTMLButtonElement;
const currentRow = () => screen.getByText('현재 상태').parentElement?.textContent ?? '';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});
afterEach(cleanup);

it('keeps the availability control collapsed and reads nothing before an admin opens it', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  render(<SourceLifecycle organizationId={7} sourceId={5} sourceLabel="주문 소스" />);

  const toggle = screen.getByRole('button', { name: '활성 상태 관리 열기' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByText(/삭제되지 않으며/)).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();

  openControl();
  expect(screen.getByRole('button', { name: '활성 상태 관리 접기' }).getAttribute('aria-expanded')).toBe('true');
  await waitFor(() => expect(currentRow()).toMatch(/버전 3/));
  expect(currentRow()).toMatch(/활성/);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/enterprise/resources/source/5/lifecycle', undefined, expect.anything());
  // The blocking consequence is spelled out without ever loading or changing stored content.
  expect(screen.getByText(/삭제되지 않으며/)).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it('shows the state difference and the blockers, then writes only the confirmed target', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  api.post.mockResolvedValueOnce(raw(lifecycle(5, false, 4)));
  render(<SourceLifecycle organizationId={7} sourceId={5} sourceLabel="주문 소스" />);
  openControl();
  await waitFor(() => expect(currentRow()).toMatch(/활성/));

  // Nothing is writable before an explicit target and an explicit agreement exist.
  expect(saveButton().disabled).toBe(true);
  expect(screen.getByText(/변경된 상태가 없습니다/)).toBeTruthy();
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);

  fireEvent.click(stateRadio('비활성'));
  expect(screen.getByText(/변경 요약: 현재 활성 → 저장 후 비활성/)).toBeTruthy();
  expect(saveButton().disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.click(consentBox());
  expect(saveButton().disabled).toBe(false);

  // Choosing the state that is already stored is not a change: no diff, no agreement, no write.
  fireEvent.click(stateRadio('활성'));
  expect(saveButton().disabled).toBe(true);
  expect(screen.getByText(/선택한 활성 상태가 이미 현재 상태입니다/)).toBeTruthy();

  // Choosing the other state again re-opens the agreement step from an unchecked box.
  fireEvent.click(stateRadio('비활성'));
  expect(consentBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);

  fireEvent.click(consentBox());
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe('/enterprise/resources/source/5/lifecycle');
  // The body carries exactly the target state and the version that was read; nothing else leaves the client.
  expect(Object.keys(body).sort()).toEqual(['active', 'expectedVersion']);
  expect(body).toEqual({ active: false, expectedVersion: 3 });

  // The receipt is the current state of this exact source: the version advanced, the draft is gone and no
  // second write followed the confirmation.
  await waitFor(() => expect(currentRow()).toMatch(/버전 4/));
  expect(currentRow()).toMatch(/비활성/);
  expect(screen.getByText(/비활성으로 저장했습니다\(버전 4\)/)).toBeTruthy();
  expect(screen.getByText(/변경된 상태가 없습니다/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('keeps the chosen state and locks writes after a conflict until the state is read again', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  api.post.mockRejectedValueOnce(status(409));
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await waitFor(() => expect(currentRow()).toMatch(/버전 3/));
  fireEvent.click(stateRadio('비활성'));
  fireEvent.click(consentBox());
  fireEvent.click(saveButton());

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await screen.findByText(/다른 곳에서 먼저 변경되었습니다/);
  await screen.findByText(/현재 상태를 다시 읽기 전에는 새 저장을 보내지 않습니다/);
  expect(stateRadio('비활성').checked).toBe(true);
  expect(consentBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);

  // Nothing is retried on its own while the choice is still on screen.
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.post).toHaveBeenCalledTimes(1);

  // A re-read becomes the new baseline. The fresh state already matches the pending choice, so nothing is saved.
  api.get.mockResolvedValueOnce(raw(lifecycle(5, false, 5)));
  fireEvent.click(requeryButton());
  await waitFor(() => expect(currentRow()).toMatch(/버전 5/));
  expect(api.get).toHaveBeenNthCalledWith(2, '/enterprise/resources/source/5/lifecycle', undefined, expect.anything());
  expect(stateRadio('비활성').checked).toBe(true);
  expect(screen.getByText(/이미 현재 상태입니다/)).toBeTruthy();
  expect(saveButton().disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);

  // A later read that moved back keeps the same draft and saves against the freshly confirmed version.
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 6)));
  fireEvent.click(requeryButton());
  await waitFor(() => expect(currentRow()).toMatch(/버전 6/));
  expect(screen.getByText(/변경 요약: 현재 활성 → 저장 후 비활성/)).toBeTruthy();
  expect(consentBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);

  api.post.mockResolvedValueOnce(raw(lifecycle(5, false, 7)));
  fireEvent.click(consentBox());
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual({ active: false, expectedVersion: 6 });
});

it('keeps the chosen state and locks writes when the write never reaches the server', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, false, 3)));
  api.post.mockRejectedValueOnce(offline());
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await waitFor(() => expect(currentRow()).toMatch(/비활성/));
  fireEvent.click(stateRadio('활성'));
  fireEvent.click(consentBox());
  fireEvent.click(saveButton());

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await screen.findByText(/서버와 통신하지 못했습니다/);
  expect(stateRadio('활성').checked).toBe(true);
  expect(consentBox().checked).toBe(false);
  expect(saveButton().disabled).toBe(true);

  // The explicit read releases the lock; the return on screen is a fresh version, so the save uses that one.
  api.get.mockResolvedValueOnce(raw(lifecycle(5, false, 3)));
  fireEvent.click(requeryButton());
  await waitFor(() => expect(screen.queryByText(/새 저장을 보내지 않습니다/)).toBeNull());
  expect(saveButton().disabled).toBe(true);

  fireEvent.click(consentBox());
  api.post.mockResolvedValueOnce(raw(lifecycle(5, true, 4)));
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual({ active: true, expectedVersion: 3 });
  await waitFor(() => expect(currentRow()).toMatch(/버전 4/));
  // Reactivating never promises more than the stored rights and the still expired or stopped publication state.
  await screen.findByText(/활성화만으로 게시가 자동 재개되지는 않습니다/);
});

it('drops the state and every control when the server refuses the owner check with 403', async () => {
  api.get.mockRejectedValueOnce(status(403));
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();

  await screen.findByText(/이 소스의 활성 상태를 관리할 권한이 없습니다/);
  expect(screen.queryByText('현재 상태')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button', { name: /^(활성 상태 저장|저장 중…)$/ })).toBeNull();
  expect(screen.getByRole('button', { name: '소스 상태 다시 확인' })).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it('clears an already loaded state when a save is refused with 403', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  api.post.mockRejectedValueOnce(status(403));
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await waitFor(() => expect(currentRow()).toMatch(/버전 3/));
  fireEvent.click(stateRadio('비활성'));
  fireEvent.click(consentBox());
  fireEvent.click(saveButton());

  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await screen.findByText(/이 소스의 활성 상태를 관리할 권한이 없습니다/);
  expect(screen.queryByText('현재 상태')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('button', { name: /^(활성 상태 저장|저장 중…)$/ })).toBeNull();
  expect(screen.getByRole('button', { name: '소스 상태 다시 확인' })).toBeTruthy();
});

it('keeps the last confirmed state readable but forbids any write when a re-read fails', async () => {
  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await waitFor(() => expect(currentRow()).toMatch(/버전 3/));

  api.get.mockRejectedValueOnce(offline());
  fireEvent.click(requeryButton());
  await screen.findByText(/서버와 통신하지 못했습니다/);
  // The former baseline stays on screen, but it is not writable until a read confirms it again.
  expect(currentRow()).toMatch(/버전 3/);

  fireEvent.click(stateRadio('비활성'));
  expect(consentBox().disabled).toBe(true);
  expect(saveButton().disabled).toBe(true);
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.post).not.toHaveBeenCalled();

  api.get.mockResolvedValueOnce(raw(lifecycle(5, true, 3)));
  fireEvent.click(requeryButton());
  await waitFor(() => expect(screen.queryByText(/새 저장을 보내지 않습니다/)).toBeNull());
  fireEvent.click(consentBox());
  api.post.mockResolvedValueOnce(raw(lifecycle(5, false, 4)));
  fireEvent.click(saveButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  // The write names the version the successful read confirmed.
  expect(api.post.mock.calls[0][1]).toEqual({ active: false, expectedVersion: 3 });
  await waitFor(() => expect(currentRow()).toMatch(/버전 4/));
});

it('drops a late answer for a source the panel already left, and aborts the read on unmount', async () => {
  const pending: { resolve?: (value: unknown) => void } = {};
  api.get.mockImplementation((url: string) => {
    if (url === '/enterprise/resources/source/5/lifecycle')
      return new Promise(resolve => {
        pending.resolve = resolve;
      });
    if (url === '/enterprise/resources/source/6/lifecycle') return Promise.resolve(raw(lifecycle(6, false, 1)));
    return Promise.reject(new Error('unexpected request'));
  });
  const view = render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

  view.rerender(<SourceLifecycle organizationId={7} sourceId={6} />);
  await waitFor(() => expect(currentRow()).toMatch(/버전 1/));
  expect(currentRow()).toMatch(/비활성/);

  await act(async () => {
    pending.resolve?.(raw(lifecycle(5, true, 9)));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.queryByText(/버전 9/)).toBeNull();
  expect(currentRow()).toMatch(/버전 1/);

  const signals: AbortSignal[] = [];
  api.get.mockImplementation((_url: string, _params: unknown, config: { signal?: AbortSignal }) => {
    if (config?.signal) signals.push(config.signal);
    return new Promise(() => undefined);
  });
  view.rerender(<SourceLifecycle organizationId={7} sourceId={7} />);
  await waitFor(() => expect(signals).toHaveLength(1));
  expect(signals[0].aborted).toBe(false);

  view.unmount();
  expect(signals[0].aborted).toBe(true);
});

it('keeps the recovery read enabled after repeated 403 and restores controls when authority returns', async () => {
  api.get
    .mockRejectedValueOnce(status(403))
    .mockRejectedValueOnce(status(403))
    .mockResolvedValueOnce(raw(lifecycle(5, false, 4)));
  render(<SourceLifecycle organizationId={7} sourceId={5} />);
  openControl();
  await screen.findByText(/이 소스의 활성 상태를 관리할 권한이 없습니다/);
  const retry = () => screen.getByRole('button', { name: '소스 상태 다시 확인' }) as HTMLButtonElement;
  expect(retry().disabled).toBe(false);
  fireEvent.click(retry());
  await screen.findByText(/이 소스의 활성 상태를 관리할 권한이 없습니다/);
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(retry().disabled).toBe(false);
  fireEvent.click(retry());
  await waitFor(() => expect(currentRow()).toContain('비활성'));
  expect(api.get).toHaveBeenCalledTimes(3);
  expect(api.post).not.toHaveBeenCalled();
});
