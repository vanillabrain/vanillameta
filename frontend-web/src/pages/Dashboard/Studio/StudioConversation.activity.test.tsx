import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioConversation from './StudioConversation';
import type { StudioRunContext } from './studioRunTransport';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const chat = vi.hoisted(() => ({ options: null as any, sendMessage: vi.fn(), stop: vi.fn(), clearError: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@ai-sdk/react', () => ({
  useChat: (options: any) => {
    chat.options = options;
    return {
      messages: [],
      sendMessage: chat.sendMessage,
      status: 'ready',
      error: null,
      clearError: chat.clearError,
      stop: chat.stop,
    };
  },
}));
vi.mock('@mui/material', () => ({
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: ({ children, disabled, onClick, type, component, href, target, rel }: any) =>
    component === 'a' ? (
      <a href={href} target={target} rel={rel}>
        {children}
      </a>
    ) : (
      <button type={type} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  TextField: ({ label, value, onChange, disabled }: any) => (
    <label>
      {label}
      <textarea aria-label={label} value={value} onChange={onChange} disabled={disabled} />
    </label>
  ),
}));
const document = {
  schemaVersion: 1 as const,
  dashboardId: 3,
  sourceId: 4,
  title: 'Saved snapshot',
  blocks: [],
  layouts: { lg: [], md: [], xs: [] },
};
const context: StudioRunContext = {
  dashboardId: 3,
  document,
  expectedRevision: 'a'.repeat(64),
  expectedSourceRevision: 'b'.repeat(64),
  clientEditVersion: 2,
};
const savedResult = { document: { ...document, revision: 'c'.repeat(64) }, idMap: {} };
const publicationResult = {
  token: 'publication_token_12345678',
  version: 2,
  visibility: 'link',
  allowRemix: false,
  expiresAt: null,
  asOf: '2026-10-15T10:30:00.000Z',
};
const partial = () => ({
  runId: 'run-publication',
  requestId: 'q1',
  dashboardId: 3,
  status: 'partial',
  baseRevision: context.expectedRevision,
  sourceRevision: context.expectedSourceRevision,
  clientEditVersion: 2,
  selectedBlockId: null,
  baseDocumentHash: 'd'.repeat(64),
  requiresRequest: false,
  saveResult: savedResult,
  steps: [
    { stepId: 'saveDraft', status: 'succeeded', retryable: false },
    { stepId: 'publish', status: 'failed', retryable: true },
  ],
});
const published = () => ({
  ...partial(),
  status: 'succeeded',
  publicationResult,
  steps: partial().steps.map(step => ({ ...step, status: 'succeeded', retryable: false })),
});
const defaultProps = { selectedTitle: undefined, onApply: vi.fn(), locked: false, onSaved: vi.fn() };

beforeEach(async () => {
  vi.clearAllMocks();
  const { webcrypto } = await import('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
  api.get.mockResolvedValue({ data: [] });
  defaultProps.onSaved.mockResolvedValue(true);
  chat.sendMessage.mockImplementation(async ({ text }: { text: string }) => {
    const options = chat.options;
    const stream = await options.transport.sendMessages({ messages: [{ role: 'user', parts: [{ type: 'text', text }] }] });
    const start = (await stream.getReader().read()).value;
    options.onFinish({ message: { metadata: start.messageMetadata }, isAbort: false, isError: false });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps the full publication outcome through onSaved and restores its link from recent GET after remount', async () => {
  api.post.mockImplementation(async (_url, body) => ({ data: { ...published(), requestId: body.requestId } }));
  const first = render(<StudioConversation {...defaultProps} context={context} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '저장하고 링크로 공유해줘' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    await chat.sendMessage.mock.results[chat.sendMessage.mock.results.length - 1].value;
  });
  await waitFor(() => expect(defaultProps.onSaved).toHaveBeenCalledWith(savedResult, expect.objectContaining(context)));
  expect(screen.getByRole('alert').textContent).toContain('저장 완료 · 게시 완료 · v2');
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  first.unmount();
  // The list carries the historical publication receipt, not the preview or saved document.
  const receipt = { ...published(), saveResult: undefined };
  api.get.mockResolvedValue({ data: [receipt] });
  render(
    <StudioConversation
      {...defaultProps}
      context={{
        ...context,
        document: savedResult.document,
        expectedRevision: savedResult.document.revision,
        clientEditVersion: 0,
      }}
    />,
  );
  const link = await screen.findByRole('link', { name: '게시본 v2 열기' });
  expect(link.getAttribute('href')).toBe('/published/publication_token_12345678');
  expect(screen.getByText('2026-10-15 10:30:00.000 UTC')).toBeDefined();
});
it('keeps saved-but-publish-failed explicit when the saved editor cannot be replaced', async () => {
  api.post.mockImplementation(async (_url, body) => ({ data: { ...partial(), requestId: body.requestId } }));
  defaultProps.onSaved.mockResolvedValue(false);
  render(<StudioConversation {...defaultProps} context={context} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '저장하고 링크로 공유해줘' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    await chat.sendMessage.mock.results[chat.sendMessage.mock.results.length - 1].value;
  });
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('현재 편집은 유지했습니다'));
  expect(screen.getByRole('alert').textContent).toContain('저장 완료 · 게시 실패');
  expect(screen.queryByRole('link')).toBeNull();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
});
it('rehydrates the committed document and retries only publication with no prompt, model or save request', async () => {
  const summary = { ...partial(), saveResult: undefined };
  api.get.mockImplementation(async (url: string) => ({ data: url === '/studio/runs' ? [summary] : partial() }));
  api.post.mockResolvedValue({ data: published() });
  render(
    <StudioConversation
      {...defaultProps}
      context={{
        ...context,
        document: savedResult.document,
        expectedRevision: savedResult.document.revision,
        clientEditVersion: 0,
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: '공유 다시 시도' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.get).toHaveBeenCalledWith('/studio/runs/run-publication');
  expect(api.post).toHaveBeenCalledWith('/studio/runs/run-publication/retry', { stepId: 'publish' }, { timeout: 180000 });
  expect(chat.sendMessage).not.toHaveBeenCalled();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  await screen.findByRole('link', { name: '게시본 v2 열기' });
});
it('blocks publication retry if manual edits no longer match the committed document', async () => {
  api.get.mockResolvedValue({ data: [partial()] });
  render(
    <StudioConversation
      {...defaultProps}
      context={{
        ...context,
        document: { ...savedResult.document, title: 'New manual edit' },
        expectedRevision: savedResult.document.revision,
        clientEditVersion: 0,
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: '공유 다시 시도' }));
  await screen.findByText(/편집 기준이 바뀌었습니다. 같은 블록과 원래 초안/);
  expect(api.post).not.toHaveBeenCalled();
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

it('does not reactivate a revoked publication when publication-only retry returns its committed receipt', async () => {
  const summary = { ...partial(), saveResult: undefined };
  api.get.mockImplementation(async (url: string) => ({ data: url === '/studio/runs' ? [summary] : partial() }));
  api.post.mockResolvedValue({
    data: {
      ...published(),
      publicationResult: {
        ...publicationResult,
        revokedAt: '2026-10-15T11:00:00.000Z',
      },
    },
  });
  render(
    <StudioConversation
      {...defaultProps}
      context={{
        ...context,
        document: savedResult.document,
        expectedRevision: savedResult.document.revision,
        clientEditVersion: 0,
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: '공유 다시 시도' }));
  await waitFor(() => expect(defaultProps.onSaved).toHaveBeenCalledOnce());
  expect(screen.getByRole('alert').textContent).toContain('저장 완료 · 게시 중지됨 · v2');
  expect(screen.getByText('게시 중지됨')).toBeDefined();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByText(/게시 완료/)).toBeNull();
  expect(api.post).toHaveBeenCalledWith('/studio/runs/run-publication/retry', { stepId: 'publish' }, { timeout: 180000 });
  expect(chat.sendMessage).not.toHaveBeenCalled();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
});
