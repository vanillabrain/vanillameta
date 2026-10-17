import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioSaveRecovery from './StudioSaveRecovery';
import { StudioPendingSave, writeStudioPendingSave, readStudioPendingSave } from './studioPendingSave';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
const fixture = (): StudioPendingSave => ({
  version: 1,
  updatedAt: Date.now(),
  phase: 'pending',
  request: {
    requestId: 'same-request',
    expectedRevision: 'a'.repeat(64),
    expectedSourceRevision: 'b'.repeat(64),
    document: {
      schemaVersion: 1,
      dashboardId: 3,
      sourceId: 4,
      title: '내 초안',
      blocks: [
        {
          id: 'b1',
          definitionKey: 'b1',
          kind: 'BOARD_NUMERIC',
          title: '매출',
          description: '',
          measureRefs: [],
          dimensionRefs: [],
          display: {},
        },
      ],
      layouts: {
        lg: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
        md: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
        xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 2 }],
      },
    },
  },
});
const latest = () => ({
  document: { ...fixture().request.document, revision: 'd'.repeat(64), title: '현재 최신본' },
  sourceRevision: 'b'.repeat(64),
  definitions: { dashboardId: 3, sourceId: 4, revision: 'd'.repeat(64), explanation: '', entries: {} },
  preview: null,
  previewError: null,
});
const setup = (r = fixture()) => {
  writeStudioPendingSave('key', r);
  sessionStorage.setItem('key', 'local draft');
  sessionStorage.setItem('question', 'keep');
  const onResolved = vi.fn(),
    onDraft = vi.fn();
  const view = render(
    <StudioSaveRecovery dashboardId={3} documentKey="key" record={r} onResolved={onResolved} onDraft={onDraft} />,
  );
  return { ...view, onResolved, onDraft, r };
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());
it('waits for explicit replay and opens fresh GET instead of the older receipt', async () => {
  api.post.mockResolvedValue({ data: { document: { ...fixture().request.document, revision: 'c'.repeat(64) }, idMap: {} } });
  api.get.mockResolvedValue({ data: latest() });
  const t = setup();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 재확인' }));
  await waitFor(() =>
    expect(t.onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ document: expect.objectContaining({ title: '현재 최신본', revision: 'd'.repeat(64) }) }),
    ),
  );
  expect(api.post.mock.calls[0][1]).toEqual(t.r.request);
  expect(readStudioPendingSave('key', 3)).toBeNull();
  expect(sessionStorage.getItem('key')).toBeNull();
  expect(sessionStorage.getItem('question')).toBe('keep');
});
it('persists confirmation before a failed latest read and retries only GET', async () => {
  api.post.mockResolvedValue({ data: { document: { ...fixture().request.document, revision: 'c'.repeat(64) }, idMap: {} } });
  api.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue({ data: latest() });
  const t = setup();
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 재확인' }));
  const retry = await screen.findByRole('button', { name: '최신 저장본 다시 조회' });
  await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
  expect(readStudioPendingSave('key', 3)?.phase).toBe('confirmed');
  expect(sessionStorage.getItem('key')).not.toBeNull();
  fireEvent.click(retry);
  await waitFor(() => expect(t.onResolved).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledTimes(2);
});
it('keeps rejected request and draft until explicit return to draft recovery', async () => {
  api.post.mockRejectedValue({ response: { status: 409 } });
  const t = setup();
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 재확인' }));
  fireEvent.click(await screen.findByRole('button', { name: '보관 초안으로 돌아가기' }));
  expect(t.onDraft).toHaveBeenCalled();
  expect(readStudioPendingSave('key', 3)).toBeNull();
  expect(sessionStorage.getItem('key')).toBe('local draft');
  expect(api.get).not.toHaveBeenCalled();
});
it('does not apply or clear data after the recovery screen unmounts', async () => {
  let finish: (v: any) => void = () => undefined;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const t = setup();
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 재확인' }));
  t.unmount();
  await act(async () => finish({ data: { document: { ...t.r.request.document, revision: 'c'.repeat(64) }, idMap: {} } }));
  expect(t.onResolved).not.toHaveBeenCalled();
  expect(readStudioPendingSave('key', 3)?.phase).toBe('pending');
  expect(api.get).not.toHaveBeenCalled();
});
