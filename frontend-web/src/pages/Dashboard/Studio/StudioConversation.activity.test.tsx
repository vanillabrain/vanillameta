import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioConversation from './StudioConversation';
import type { StudioRunContext } from './studioRunTransport';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const chat = vi.hoisted(() => ({
  options: null as any,
  sendMessage: vi.fn(),
  stop: vi.fn(),
  clearError: vi.fn(),
  setMessages: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@ai-sdk/react', () => ({
  useChat: (options: any) => {
    chat.options = options;
    return {
      messages: [],
      setMessages: chat.setMessages,
      sendMessage: chat.sendMessage,
      status: 'ready',
      error: null,
      clearError: chat.clearError,
      stop: chat.stop,
    };
  },
}));
vi.mock('./StudioSemanticReview', () => ({ default: () => <div>Semantic preview</div> }));
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

vi.mock('./StudioRemix', () => ({
  StudioRemixFlow: ({ onSave }: any) => (
    <button
      onClick={() =>
        onSave(
          {
            requestId: 'confirmed-mapping',
            targetSourceId: 22,
            mapping: { amount: 'amount' },
            excludedBlockIds: [],
            expectedVersion: 3,
            expectedSourceRevision: 'b'.repeat(64),
          },
          () => true,
        ).catch(() => undefined)
      }
    >
      매핑 확인 후 비공개 생성
    </button>
  ),
}));

it('completes confirmed mapping inside the conversation without applying the clone to the current editor', async () => {
  const run = {
    ...partial(),
    status: 'succeeded',
    steps: [{ stepId: 'remix', status: 'succeeded', retryable: false }],
    remixResult: { token: 'a'.repeat(64), version: 3 },
    saveResult: undefined,
  };
  api.get.mockResolvedValue({ data: [run] });
  api.post.mockResolvedValue({
    data: { ...run, remixSaveResult: { dashboardId: 44, sourceId: 22, revision: 'c'.repeat(64), version: 3 } },
  });
  render(<StudioConversation {...defaultProps} context={context} />);
  fireEvent.click(await screen.findByRole('button', { name: '내 데이터 연결하고 복제 계속' }));
  fireEvent.click(screen.getByRole('button', { name: '매핑 확인 후 비공개 생성' }));
  const link = await screen.findByRole('link', { name: '비공개 복제본 열기' });
  expect(link.getAttribute('href')).toBe('/dashboard/44/studio');
  expect(api.post.mock.calls[0][0]).toBe('/studio/runs/run-publication/remix');
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
  expect(chat.sendMessage).not.toHaveBeenCalled();
});

it('does not claim an absent clone when the confirmed save response is lost', async () => {
  const run = {
    ...partial(),
    status: 'succeeded',
    steps: [{ stepId: 'remix', status: 'succeeded', retryable: false }],
    remixResult: { token: 'a'.repeat(64), version: 3 },
    saveResult: undefined,
  };
  api.get.mockResolvedValue({ data: [run] });
  api.post.mockRejectedValue(new Error('lost response'));
  render(<StudioConversation {...defaultProps} context={context} />);
  fireEvent.click(await screen.findByRole('button', { name: '내 데이터 연결하고 복제 계속' }));
  fireEvent.click(screen.getByRole('button', { name: '매핑 확인 후 비공개 생성' }));
  await screen.findByText(/비공개 복제의 완료 여부를 확인하지 못했습니다/);
  expect(screen.queryByText(/아직 복제본은 저장되지 않았습니다/)).toBeNull();
  expect(screen.queryByRole('link', { name: '비공개 복제본 열기' })).toBeNull();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
  api.get.mockResolvedValue({
    data: [{ ...run, remixSaveResult: { dashboardId: 44, sourceId: 22, revision: 'c'.repeat(64), version: 3 } }],
  });
  fireEvent.click(screen.getByRole('button', { name: '상태 새로고침' }));
  await screen.findByRole('link', { name: '비공개 복제본 열기' });
  expect(screen.queryByText(/비공개 복제의 완료 여부를 확인하지 못했습니다/)).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('dispatches new creation without applying a new document to the current editor', async () => {
  const run = {
    ...partial(),
    status: 'succeeded',
    saveResult: undefined,
    steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
    creationResult: { proposalId: 'new-proposal', sourceId: 4, sourceRevision: 'b'.repeat(64) },
  };
  api.post.mockImplementation(async (_url, body) => ({ data: { ...run, requestId: body.requestId } }));
  render(<StudioConversation {...defaultProps} context={context} />);
  const input = screen.getByRole('textbox', { name: 'AI에게 요청할 내용' });
  fireEvent.change(input, { target: { value: '새 대시보드를 만들어줘' } });
  fireEvent.submit(input.closest('form'));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][0]).toBe('/studio/executions');
  await screen.findAllByText(/새 대시보드 제안 완료/);
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
});

it('rejects a new creation response for another source before exposing its proposal', async () => {
  api.post.mockResolvedValue({
    data: {
      ...partial(),
      status: 'succeeded',
      saveResult: undefined,
      steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
      creationResult: { proposalId: 'wrong-source', sourceId: 99, sourceRevision: 'b'.repeat(64) },
    },
  });
  render(<StudioConversation {...defaultProps} context={context} />);
  await expect(
    chat.options.transport.sendMessages({
      messages: [{ role: 'user', parts: [{ type: 'text', text: '새 대시보드 생성' }] }],
    }),
  ).rejects.toThrow('실행 결과를 검증하지 못');
  expect(screen.queryByText(/새 대시보드 제안 완료/)).toBeNull();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
});

const creationRun = () => ({
  runId: 'composer-create',
  requestId: 'q-create',
  dashboardId: 3,
  status: 'succeeded',
  steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
  creationResult: { proposalId: 'parent', sourceId: 4, sourceRevision: 'b'.repeat(64) },
});
it('UC036 sends the main composer to the latest creation, preserves uncertain input, and retries the same envelope without applying the original', async () => {
  const run = creationRun();
  api.get.mockImplementation(async (url: string) => ({ data: url === '/studio/runs' ? [run] : {} }));
  api.post
    .mockRejectedValueOnce(new Error('lost'))
    .mockResolvedValueOnce({ data: { ...run, creationResult: { ...run.creationResult, proposalId: 'edited' } } });
  render(<StudioConversation {...defaultProps} context={context} />);
  await screen.findByText(/대상: 저장 전 생성안/);
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '첫 번째 블록 제목 변경' } });
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  await screen.findByRole('button', { name: '같은 생성안 요청 다시 확인' });
  expect((screen.getByLabelText('AI에게 요청할 내용') as HTMLTextAreaElement).value).toBe('첫 번째 블록 제목 변경');
  expect((screen.getByLabelText('AI에게 요청할 내용') as HTMLTextAreaElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '원본 편집으로 돌아가기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '같은 생성안 요청 다시 확인' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[0][0]).toBe('/studio/runs/composer-create/creation/message');
  expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
  expect(chat.sendMessage).not.toHaveBeenCalled();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
});
it('UC036 exits creation context explicitly without sending a request or losing typed input', async () => {
  const run = creationRun();
  api.get.mockImplementation(async (url: string) => ({ data: url === '/studio/runs' ? [run] : {} }));
  render(<StudioConversation {...defaultProps} context={context} />);
  await screen.findByText(/대상: 저장 전 생성안/);
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '질문 보존' } });
  fireEvent.click(screen.getByRole('button', { name: '원본 편집으로 돌아가기' }));
  await screen.findByText('대상: 현재 원본 편집');
  expect((screen.getByLabelText('AI에게 요청할 내용') as HTMLTextAreaElement).value).toBe('질문 보존');
  expect(api.post).not.toHaveBeenCalled();
  expect(chat.sendMessage).not.toHaveBeenCalled();
});
it('UC036 saves the creation through the main composer without replacing the original editor and keeps the saved creation context', async () => {
  const run = creationRun();
  api.get.mockImplementation(async (url: string) => ({ data: url === '/studio/runs' ? [run] : {} }));
  api.post.mockResolvedValue({
    data: { ...run, creationSaveResult: { dashboardId: 99, sourceId: 4, revision: 'c'.repeat(64) } },
  });
  render(<StudioConversation {...defaultProps} context={context} />);
  await screen.findByText(/대상: 저장 전 생성안/);
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '이 생성안을 저장해 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  await screen.findByText('대상: 저장한 새 대시보드 #99');
  expect(api.post.mock.calls[0][0]).toBe('/studio/runs/composer-create/creation/message');
  expect(screen.getByRole('link', { name: '새 비공개 대시보드 열기' }).getAttribute('href')).toBe('/dashboard/99/studio');
  expect(chat.sendMessage).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
});

const savedCreationRun = () => ({
  ...creationRun(),
  creationSaveResult: { dashboardId: 99, sourceId: 4, revision: 'c'.repeat(64) },
});
it('UC037 restores the saved target without opening or publishing and hands off only that copy with its saved revision', async () => {
  api.get.mockResolvedValue({ data: [savedCreationRun()] });
  const onPrepareCreationPublication = vi.fn();
  render(
    <StudioConversation {...defaultProps} context={context} onPrepareCreationPublication={onPrepareCreationPublication} />,
  );
  await screen.findByText('대상: 저장한 새 대시보드 #99');
  expect(onPrepareCreationPublication).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '게시 준비해 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  expect(onPrepareCreationPublication).toHaveBeenCalledWith(savedCreationRun().creationSaveResult);
  expect(api.post).not.toHaveBeenCalled();
  expect(chat.sendMessage).not.toHaveBeenCalled();
  expect(defaultProps.onApply).not.toHaveBeenCalled();
  expect(defaultProps.onSaved).not.toHaveBeenCalled();
});
it.each(['게시하지 말아 줘', '게시 준비해 줘 그리고 제목 바꿔 줘', '원본을 게시 준비해 줘', '첫 블록 수정해 줘'])(
  'UC037 preserves unsupported question and never falls back to original: %s',
  async question => {
    api.get.mockResolvedValue({ data: [savedCreationRun()] });
    render(<StudioConversation {...defaultProps} context={context} />);
    await screen.findByText('대상: 저장한 새 대시보드 #99');
    fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: question } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect((screen.getByLabelText('AI에게 요청할 내용') as HTMLTextAreaElement).value).toBe(question);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '원본 편집으로 돌아가기' }));
    expect(screen.getByText('대상: 현재 원본 편집')).toBeDefined();
    expect((screen.getByLabelText('AI에게 요청할 내용') as HTMLTextAreaElement).value).toBe(question);
  },
);
