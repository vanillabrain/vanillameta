import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioConversationCreation from './StudioConversationCreation';
import { CHART_SETUP_UNAVAILABLE_MESSAGE } from './studioCreation';
const api = vi.hoisted(() => ({ read: vi.fn(), sources: vi.fn() }));
vi.mock('./studioExecution', () => ({ getExecutionCreation: api.read }));
vi.mock('./studioCreation', async importOriginal => ({ ...(await importOriginal<any>()), fetchStudioSources: api.sources }));
vi.mock('./StudioSemanticReview', () => ({ default: ({ proposal }: any) => <div>{proposal.title} · 634,513,000</div> }));
const run: any = { runId: 'creation1', creationResult: { proposalId: 'p1', sourceId: 9 } };
const proposal = {
  semanticProposal: [{ title: '요청 수' }],
  title: '새 요청 분석',
  profile: { rowCount: '1391572' },
  preview: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  api.read.mockResolvedValue(proposal);
  api.sources.mockResolvedValue([{ id: 12, name: 'Commerce', engine: 'duckdb' }]);
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
  expect(screen.queryByRole('button', { name: '제안 확인 후 비공개 저장' })).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
it('removes a stale preview and save control after the server rejects an expired proposal', async () => {
  const save = vi.fn().mockRejectedValue({ response: { status: 400 } });
  render(<StudioConversationCreation run={run} onSave={save} disabled={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '제안 확인 후 비공개 저장' }));
  expect(await screen.findByText('생성안이 만료되었거나 저장할 수 없습니다. 새 생성 요청을 보내 주세요.')).toBeDefined();
  expect(screen.queryByRole('button', { name: '제안 확인 후 비공개 저장' })).toBeNull();
  expect(screen.getByRole('button', { name: '생성안 다시 불러오기' })).toBeDefined();
  expect(screen.queryByText(/634,513,000/)).toBeNull();
  expect(save).toHaveBeenCalledTimes(1);
  expect(api.read).toHaveBeenCalledTimes(1);
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
it('shows the server message for an unsupported request without a source picker or retry', async () => {
  const question = '상위 3개 제한은 아직 지원하지 않습니다. 요청을 바꿔 다시 확인해 주세요.';
  api.read.mockResolvedValue({
    ...proposal,
    preview: undefined,
    clarifications: [{ id: 'unsupportedRequest', question, choices: [], affectedBlockIds: [] }],
  });
  const view = render(<StudioConversationCreation run={run} onClarify={vi.fn()} disabled={false} />);
  expect(await screen.findByText(question)).toBeDefined();
  expect(screen.queryByLabelText('다시 분석할 데이터')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText(/이어서 확인/)).toBeNull();
  expect(api.sources).not.toHaveBeenCalled();
  view.unmount();
  render(<StudioConversationCreation run={run} disabled={false} />);
  await screen.findByText(question);
  expect(screen.queryByRole('link', { name: '같은 질문의 계산 기준 확인' })).toBeNull();
});
it('explains a missing chart setup on save without the generic expired-proposal text', async () => {
  const save = vi.fn().mockRejectedValue({
    response: { status: 400, data: { success: false, code: 400, data: 'chart component unavailable' } },
  });
  render(<StudioConversationCreation run={run} onSave={save} disabled={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '제안 확인 후 비공개 저장' }));
  expect(await screen.findByText(CHART_SETUP_UNAVAILABLE_MESSAGE)).toBeDefined();
  expect(screen.queryByText(/잠시 후/)).toBeNull();
  expect(screen.queryByText('생성안이 만료되었거나 저장할 수 없습니다. 새 생성 요청을 보내 주세요.')).toBeNull();
  expect(screen.queryByText(/chart component/)).toBeNull();
});

it('does not steal focus when a completed historical receipt is restored', () => {
  render(<StudioConversationCreation run={{ ...run, creationSaveResult: { dashboardId: 25 } }} disabled={false} />);
  expect(document.activeElement).not.toBe(screen.getByRole('status'));
  expect(api.read).not.toHaveBeenCalled();
});

it('continues a clarification through its permission checked proposal without exposing the question in the URL', async () => {
  api.read.mockResolvedValue({
    ...proposal,
    sourceId: 9,
    proposalId: 'clarify-parent',
    preview: undefined,
    clarifications: [{ id: 'refundDenominator', question: '분모는?', choices: [{ value: 'amount', label: '매출 금액' }] }],
  });
  render(<StudioConversationCreation run={run} disabled={false} />);
  const link = await screen.findByRole('link', { name: '같은 질문의 계산 기준 확인' });
  expect(link.getAttribute('href')).toBe('/studio/new?sourceId=9&proposalId=clarify-parent');
  expect(screen.queryByRole('button')).toBeNull();
});

it('UC033 answers inline without opening a tab or saving and displays the newly bound preview', async () => {
  const parent: any = {
    ...proposal,
    sourceId: 9,
    proposalId: 'p1',
    sourceRevision: 'a'.repeat(64),
    preview: undefined,
    clarifications: [
      {
        id: 'refundDenominator',
        question: '분모를 선택해 주세요',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
      },
    ],
  };
  api.read
    .mockResolvedValueOnce(parent)
    .mockResolvedValueOnce({ ...parent, proposalId: 'p2', clarifications: [], preview: {} });
  const clarify = vi.fn().mockResolvedValue(undefined),
    save = vi.fn();
  const view = render(<StudioConversationCreation run={run} onSave={save} onClarify={clarify} disabled={false} />);
  const choice = await screen.findByRole('combobox', { name: '환불률 분모' });
  expect((screen.getByRole('button', { name: '답변하고 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(choice, { target: { value: 'amount' } });
  fireEvent.click(screen.getByRole('button', { name: '답변하고 미리보기' }));
  await waitFor(() => expect(clarify).toHaveBeenCalledTimes(1));
  expect(clarify.mock.calls[0][1]).toMatchObject({
    proposalId: 'p1',
    expectedSourceRevision: 'a'.repeat(64),
    refundDenominator: 'amount',
  });
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: '같은 질문의 계산 기준 확인' })).toBeNull();
  view.rerender(
    <StudioConversationCreation
      run={{ ...run, creationResult: { ...run.creationResult, proposalId: 'p2' } }}
      onSave={save}
      onClarify={clarify}
      disabled={false}
    />,
  );
  expect(await screen.findByRole('button', { name: '제안 확인 후 비공개 저장' })).toBeDefined();
});
it('UC033 preserves an uncertain answer and retries the exact same request without enabling another choice', async () => {
  api.read.mockResolvedValue({
    ...proposal,
    proposalId: 'p1',
    sourceRevision: 'a'.repeat(64),
    preview: undefined,
    clarifications: [
      {
        id: 'refundDenominator',
        question: '분모?',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
      },
    ],
  });
  const clarify = vi.fn().mockRejectedValue(new Error('lost'));
  render(<StudioConversationCreation run={run} onClarify={clarify} disabled={false} />);
  fireEvent.change(await screen.findByRole('combobox', { name: '환불률 분모' }), { target: { value: 'amount' } });
  fireEvent.click(screen.getByRole('button', { name: '답변하고 미리보기' }));
  await screen.findByRole('button', { name: '같은 답변으로 다시 확인' });
  expect((screen.getByRole('combobox', { name: '환불률 분모' }) as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '같은 답변으로 다시 확인' }));
  await waitFor(() => expect(clarify).toHaveBeenCalledTimes(2));
  expect(clarify.mock.calls[0][1]).toEqual(clarify.mock.calls[1][1]);
});

it('UC033 retries a failed preview read without replaying an answer or a save', async () => {
  api.read.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce(proposal);
  const clarify = vi.fn(),
    save = vi.fn();
  render(<StudioConversationCreation run={run} onClarify={clarify} onSave={save} disabled={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '생성안 다시 불러오기' }));
  await screen.findByRole('button', { name: '제안 확인 후 비공개 저장' });
  expect(api.read).toHaveBeenCalledTimes(2);
  expect(clarify).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('UC034 retries a source list read, preserves the selected source after uncertain response, and never saves implicitly', async () => {
  api.read.mockResolvedValue({
    ...proposal,
    sourceId: 9,
    proposalId: 'p1',
    sourceRevision: 'a'.repeat(64),
    preview: undefined,
    clarifications: [{ id: 'missingColumns', question: 'revenue 열 없음', choices: [] }],
  });
  api.sources.mockRejectedValueOnce(new Error('offline'));
  const clarify = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(undefined),
    save = vi.fn();
  render(<StudioConversationCreation run={run} onClarify={clarify} onSave={save} disabled={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '소스 목록 다시 불러오기' }));
  await screen.findByRole('option', { name: 'Commerce' });
  fireEvent.change(screen.getByLabelText('다시 분석할 데이터'), { target: { value: '12' } });
  expect(clarify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '이 소스로 미리보기' }));
  expect(await screen.findByRole('button', { name: '같은 답변으로 다시 확인' })).toBeDefined();
  expect((screen.getByLabelText('다시 분석할 데이터') as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByLabelText('다시 분석할 데이터') as HTMLSelectElement).value).toBe('12');
  fireEvent.click(screen.getByRole('button', { name: '같은 답변으로 다시 확인' }));
  await waitFor(() => expect(clarify).toHaveBeenCalledTimes(2));
  expect(clarify.mock.calls[0][1]).toEqual(clarify.mock.calls[1][1]);
  expect(clarify.mock.calls[0][1]).toMatchObject({ proposalId: 'p1', targetSourceId: 12 });
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: '같은 질문의 계산 기준 확인' })).toBeNull();
});
it('UC034 ignores a late source list after the new proposal no longer requires fields', async () => {
  let finish: (x: any) => void;
  api.read
    .mockResolvedValueOnce({
      ...proposal,
      sourceId: 9,
      proposalId: 'p1',
      preview: undefined,
      clarifications: [{ id: 'missingColumns', question: '열 없음', choices: [] }],
    })
    .mockResolvedValueOnce(proposal);
  api.sources.mockImplementationOnce(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  const view = render(<StudioConversationCreation run={run} onClarify={vi.fn()} disabled={false} />);
  await screen.findByText('데이터 소스를 불러오는 중…');
  view.rerender(
    <StudioConversationCreation
      run={{ ...run, creationResult: { ...run.creationResult, proposalId: 'next' } }}
      onClarify={vi.fn()}
      disabled={false}
    />,
  );
  await screen.findByText(/634,513,000/);
  finish([{ id: 12, name: 'Late source', engine: 'duckdb' }]);
  await waitFor(() => expect(screen.queryByLabelText('다시 분석할 데이터')).toBeNull());
});

it('UC034 keeps the source preparation route when no alternative source is available', async () => {
  api.sources.mockResolvedValue([
    { id: 9, name: 'Current', engine: 'duckdb' },
    { id: 29, name: 'Legacy', engine: 'sqlite3' },
  ]);
  api.read.mockResolvedValue({
    ...proposal,
    sourceId: 9,
    proposalId: 'missing-parent',
    preview: undefined,
    clarifications: [{ id: 'missingColumns', question: '열 없음', choices: [] }],
  });
  render(<StudioConversationCreation run={run} onClarify={vi.fn()} disabled={false} />);
  const link = await screen.findByRole('link', { name: '파일·원본 열 확인' });
  expect(link.getAttribute('href')).toBe('/studio/new?sourceId=9&proposalId=missing-parent');
  expect((screen.getByRole('button', { name: '이 소스로 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
});

it('UC035 keeps refinement collapsed, preserves an uncertain question and locks saving until the identical retry completes', async () => {
  api.read.mockResolvedValue({ ...proposal, proposalId: 'p1', sourceRevision: 'a'.repeat(64) });
  const clarify = vi.fn().mockRejectedValueOnce(new Error('lost')).mockResolvedValue(undefined),
    save = vi.fn();
  render(<StudioConversationCreation run={run} onClarify={clarify} onSave={save} disabled={false} />);
  const summary = await screen.findByText('이 생성안 수정');
  expect(summary.closest('details')?.open).toBe(false);
  fireEvent.click(summary);
  fireEvent.change(screen.getByLabelText('생성안에 다시 질문'), { target: { value: '제목만 합계로 바꿔 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '수정안 전체 미리보기' }));
  await screen.findByRole('button', { name: '같은 수정 요청으로 다시 확인' });
  expect((screen.getByLabelText('생성안에 다시 질문') as HTMLTextAreaElement).value).toBe('제목만 합계로 바꿔 줘');
  expect((screen.getByLabelText('생성안에 다시 질문') as HTMLTextAreaElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '제안 확인 후 비공개 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/634,513,000/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '같은 수정 요청으로 다시 확인' }));
  await waitFor(() => expect(clarify).toHaveBeenCalledTimes(2));
  expect(clarify.mock.calls[0][1]).toEqual(clarify.mock.calls[1][1]);
  expect(clarify.mock.calls[0][1]).toMatchObject({ targetBlockIndex: 0, prompt: '제목만 합계로 바꿔 줘' });
  expect(save).not.toHaveBeenCalled();
});

const refusal = (status: number, error: string, message: string) =>
  Object.assign(new Error('Request failed with status code ' + status), {
    response: { status, data: { success: false, code: status, data: { error, message } } },
  });

it('shows the server’s quota sentence for a refused answer and offers no "same answer again" retry', async () => {
  api.read.mockResolvedValue({
    ...proposal,
    proposalId: 'p1',
    sourceRevision: 'a'.repeat(64),
    preview: undefined,
    clarifications: [
      {
        id: 'refundDenominator',
        question: '분모?',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
      },
    ],
  });
  const clarify = vi.fn().mockRejectedValue(refusal(429, 'AI_QUOTA_EXCEEDED', '이 계정의 AI 사용 한도에 도달했습니다.'));
  render(<StudioConversationCreation run={run} onClarify={clarify} disabled={false} />);
  fireEvent.change(await screen.findByRole('combobox', { name: '환불률 분모' }), { target: { value: 'amount' } });
  fireEvent.click(screen.getByRole('button', { name: '답변하고 미리보기' }));
  expect(await screen.findByText(/AI 사용 한도에 도달했습니다/)).toBeDefined();
  // Nothing ran, so this is not an uncertain result: the choice stays editable and no retry-the-same prompt.
  expect(screen.queryByRole('button', { name: '같은 답변으로 다시 확인' })).toBeNull();
  expect((screen.getByRole('combobox', { name: '환불률 분모' }) as HTMLSelectElement).disabled).toBe(false);
  expect(screen.queryByText(/생성안이 만료되었거나/)).toBeNull();
});

it('does not lock saving behind "the same edit again" when the refinement is refused for the budget', async () => {
  api.read.mockResolvedValue({ ...proposal, proposalId: 'p1', sourceRevision: 'a'.repeat(64) });
  const clarify = vi
    .fn()
    .mockRejectedValue(refusal(503, 'AI_BUDGET_EXHAUSTED', '이번 달 서비스 전체의 AI 사용량이 한도에 도달했습니다.'));
  render(<StudioConversationCreation run={run} onClarify={clarify} onSave={vi.fn()} disabled={false} />);
  fireEvent.click(await screen.findByText('이 생성안 수정'));
  fireEvent.change(screen.getByLabelText('생성안에 다시 질문'), { target: { value: '제목만 합계로 바꿔 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '수정안 전체 미리보기' }));
  expect(await screen.findByText(/서비스 전체의 AI 사용량이 한도에 도달했습니다/)).toBeDefined();
  expect(screen.queryByRole('button', { name: '같은 수정 요청으로 다시 확인' })).toBeNull();
  expect((screen.getByLabelText('생성안에 다시 질문') as HTMLTextAreaElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: '제안 확인 후 비공개 저장' }) as HTMLButtonElement).disabled).toBe(false);
});
