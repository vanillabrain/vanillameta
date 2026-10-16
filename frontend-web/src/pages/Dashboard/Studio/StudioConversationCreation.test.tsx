import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioConversationCreation from './StudioConversationCreation';
const api = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./studioExecution', () => ({ getExecutionCreation: api.read }));
vi.mock('./StudioSemanticReview', () => ({ default: ({ proposal }: any) => <div>{proposal.title} · 634,513,000</div> }));
const run: any = { runId: 'creation1', creationResult: { proposalId: 'p1', sourceId: 9 } };
const proposal = { title: '새 요청 분석', profile: { rowCount: '1391572' }, preview: {} };
beforeEach(() => {
  vi.clearAllMocks();
  api.read.mockResolvedValue(proposal);
});
afterEach(cleanup);
it('loads only cached preview and confirms through the run-bound handler; double clicks cannot duplicate a pending write', async () => {
  let finish: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  render(<StudioConversationCreation run={run} onSave={save} disabled={false} />);
  expect(await screen.findByText(/634,513,000/)).toBeDefined();
  expect(screen.getByText(/전체 기간 · 필터 없음/)).toBeDefined();
  expect(save).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: '제안 확인 후 비공개 저장' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(run);
  finish();
  await waitFor(() => expect(screen.getByRole('button', { name: '제안 확인 후 비공개 저장' })).toBeDefined());
});
it('keeps uncertain requests retryable and restores the durable receipt with a local new-tab link', async () => {
  const save = vi.fn().mockRejectedValue(new Error('response lost'));
  const view = render(<StudioConversationCreation run={run} onSave={save} disabled={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '제안 확인 후 비공개 저장' }));
  expect(await screen.findByText(/저장 완료 여부를 확인하지 못/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '같은 생성 요청으로 저장 확인' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  view.rerender(
    <StudioConversationCreation run={{ ...run, creationSaveResult: { dashboardId: 25 } }} onSave={save} disabled={false} />,
  );
  expect(screen.getByRole('status').textContent).toContain('비공개 생성 완료');
  expect(document.activeElement).toBe(screen.getByRole('status'));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/25/studio');
  expect(api.read).toHaveBeenCalledTimes(1);
});
it('shows expired proposal guidance without invoking creation or showing a save button', async () => {
  api.read.mockRejectedValue(new Error('expired'));
  const save = vi.fn();
  render(<StudioConversationCreation run={run} onSave={save} disabled={false} />);
  expect(await screen.findByRole('alert')).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
it('displays missing meaning and blocks saving when the compiler asks for clarification', async () => {
  api.read.mockResolvedValue({
    ...proposal,
    preview: undefined,
    clarifications: [{ id: 'missingColumns', question: '필수 열을 확인해 주세요', choices: [] }],
  });
  render(<StudioConversationCreation run={run} disabled={false} />);
  expect(await screen.findByText(/필수 열을 확인/)).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});

it('does not steal focus when a completed historical receipt is restored', () => {
  render(<StudioConversationCreation run={{ ...run, creationSaveResult: { dashboardId: 25 } }} disabled={false} />);
  expect(document.activeElement).not.toBe(screen.getByRole('status'));
  expect(api.read).not.toHaveBeenCalled();
});
