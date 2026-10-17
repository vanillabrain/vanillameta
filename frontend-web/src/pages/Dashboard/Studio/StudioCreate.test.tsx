import React from 'react';
import { webcrypto } from 'node:crypto';
import { setToken } from '@/helpers/authHelper';
import { creationConfirmationKey, writeCreationConfirmation } from './studioCreationRecovery';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import StudioCreate from './StudioCreate';
import { creationQuestionKey, writeCreationQuestion, readCreationQuestion } from './studioCreationQuestion';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), upload: vi.fn(), params: '' }));
vi.mock('@/helpers/apiHelper', () => ({ get: mocks.get, post: mocks.post }));
vi.mock('@/api/databaseService', () => ({ default: { uploadFile: mocks.upload } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.params)],
  Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div>Chart</div> }));
const profile = (id = 4) => ({
  sourceId: id,
  name: 'Orders ' + id,
  supported: true,
  rowCount: '2',
  columns: [{ name: 'amount', type: 'BIGINT', numeric: true, nullCount: '0' }],
});
const proposal = () => ({
  proposalId: 'proposal-1',
  sourceId: 4,
  sourceRevision: 'a'.repeat(64),
  title: '매출 요약',
  profile: profile(),
  semanticProposal: [
    { title: '총매출', kind: 'BOARD_NUMERIC', metric: { aggregation: 'SUM', column: 'amount', label: '총매출' } },
  ],
  preview: {
    draft: {
      databaseId: 4,
      title: '매출 요약',
      explanation: '',
      widgets: [
        {
          type: 'BOARD_NUMERIC',
          title: '총매출',
          description: '',
          sql: 'SELECT SUM(amount) AS value FROM source',
          valueField: 'value',
        },
      ],
    },
    widgets: [
      {
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM(amount) AS value FROM source',
        valueField: 'value',
        fields: [],
        datas: [{ value: 500 }],
      },
    ],
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.params = '';
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, randomUUID: () => '11111111-1111-4111-8111-111111111111' });
  setToken('unit-studio-session');
  mocks.get.mockImplementation(async (url: string) => ({
    data: {
      status: 'SUCCESS',
      data:
        url === '/bi/sources'
          ? [
              { id: 4, name: 'Orders 4', engine: 'duckdb' },
              { id: 5, name: 'Orders 5', engine: 'duckdb' },
            ]
          : url.startsWith('/bi/metrics')
          ? []
          : profile(Number(url.split('/')[3])),
    },
  }));
  mocks.post.mockImplementation(async (url: string) => ({ data: url === '/studio/samples' ? { sourceId: 4 } : proposal() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const ready = async () => {
  render(<StudioCreate />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '매출·환불 샘플' }));
  await screen.findByText(/2행 · \d+개 열 · 서버 DuckDB/);
  await waitFor(() => {
    expect((screen.getByRole('combobox', { name: '저장된 데이터' }) as HTMLSelectElement).value).toBe('4');
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(false);
  });
  fireEvent.change(screen.getByRole('textbox', { name: '만들 대시보드 요청' }), { target: { value: '총매출을 보여 줘' } });
};
describe('Studio create workflow', () => {
  it('offers only supported commerce questions and fills the editable prompt without posting', async () => {
    const fallback = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(async (url: string, ...args: any[]) =>
      url.endsWith('/profile')
        ? {
            data: {
              ...profile(),
              columns: [
                { name: 'revenue', numeric: true },
                { name: 'refund_amount', numeric: true },
                { name: 'net_amount', numeric: true },
                { name: 'paid_orders', numeric: true },
                { name: 'refunded_orders', numeric: true },
                { name: 'ordered_at', temporal: true },
              ],
            },
          }
        : fallback(url, ...args),
    );
    await ready();
    mocks.post.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '매출·환불 요약' }));
    const input = screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement;
    expect(input.value).toContain('결제 성공액');
    expect(document.activeElement).toBe(input);
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '주문 기준 환불률' }));
    expect(input.value).toContain('주문 수 기준');
    expect(screen.getByRole('button', { name: '주문일별 결제 추세' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    expect((screen.getByRole('button', { name: '매출·환불 요약' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('hides questions whose required numeric data is entirely null', async () => {
    const fallback = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(async (url: string, ...args: any[]) =>
      url.endsWith('/profile')
        ? {
            data: {
              ...profile(),
              columns: [
                { name: 'revenue', numeric: true, nullCount: '2' },
                { name: 'refund_amount', numeric: true },
                { name: 'net_amount', numeric: true },
                { name: 'ordered_at', temporal: true },
              ],
            },
          }
        : fallback(url, ...args),
    );
    await ready();
    expect(screen.queryByRole('group', { name: '추천 질문' })).toBeNull();
  });
  it('does not offer commerce prompts for unrelated or insufficient columns', async () => {
    await ready();
    expect(screen.queryByRole('button', { name: '매출·환불 요약' })).toBeNull();
    expect(screen.queryByRole('button', { name: '주문 기준 환불률' })).toBeNull();
    expect(screen.queryByRole('button', { name: '주문일별 결제 추세' })).toBeNull();
  });
  it.each([
    {
      columns: ['revenue', 'refund_amount', 'net_amount'],
      example: '예: 결제 성공액, 환불액, 차감 수취액을 각각 숫자 지표로 보여 줘.',
    },
    {
      columns: ['bid_request_cnt', 'bid_floor', 'has_bid_floor_cnt'],
      example: '예: 총 요청 수와 평균 입찰 하한을 보여 줘.',
    },
    { columns: ['amount'], example: '예: 이 데이터에서 확인하고 싶은 지표를 적어 주세요.' },
  ])('uses a source-specific placeholder for $columns without sending the example', async ({ columns, example }) => {
    const fallback = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(async (url: string, ...args: any[]) =>
      url.endsWith('/profile')
        ? {
            data: { ...profile(), columns: columns.map(name => ({ name, numeric: true, nullCount: '0' })) },
          }
        : fallback(url, ...args),
    );
    await ready();
    const input = screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement;
    expect(input.placeholder).toBe(example);
    expect(input.value).toBe('총매출을 보여 줘');
    expect(mocks.post.mock.calls.map(call => call[0])).toEqual(['/studio/samples']);
  });
  it('updates the placeholder after source switching while preserving the typed question', async () => {
    const fallback = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(async (url: string, ...args: any[]) =>
      url.endsWith('/profile')
        ? {
            data: {
              ...profile(Number(url.split('/')[3])),
              columns: url.includes('/4/')
                ? ['revenue', 'refund_amount', 'net_amount'].map(name => ({ name, numeric: true }))
                : profile(5).columns,
            },
          }
        : fallback(url, ...args),
    );
    await ready();
    const input = screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement;
    expect(input.placeholder).toContain('결제 성공액');
    mocks.post.mockClear();
    fireEvent.change(screen.getByRole('combobox', { name: '저장된 데이터' }), { target: { value: '5' } });
    await waitFor(() => expect(input.placeholder).toBe('예: 이 데이터에서 확인하고 싶은 지표를 적어 주세요.'));
    expect(input.value).toBe('총매출을 보여 줘');
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('previews semantics without saving, invalidates proposal on prompt edits', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    expect(mocks.post.mock.calls.map(c => c[0])).toEqual(['/studio/samples', '/studio/proposals']);
    fireEvent.change(screen.getByRole('textbox', { name: '만들 대시보드 요청' }), { target: { value: '다른 요청' } });
    expect(screen.queryByRole('button', { name: 'Studio에 저장하고 열기' })).toBeNull();
  });
  it('requires denominator clarification before it offers save', async () => {
    const unclear: any = proposal();
    delete unclear.preview;
    unclear.semanticProposal = [];
    unclear.clarifications = [
      {
        id: 'refundDenominator',
        question: '환불률 분모',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
        affectedBlockIds: [],
      },
    ];
    mocks.post.mockImplementation(async (url: string) => ({ data: url === '/studio/samples' ? { sourceId: 4 } : unclear }));
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('계산 전에 확인해 주세요');
    expect(screen.queryByRole('button', { name: 'Studio에 저장하고 열기' })).toBeNull();
    expect((screen.getByRole('button', { name: '의미 확인 후 다시 제안' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('retries creation with the exact idempotency body after response loss', async () => {
    let saves = 0;
    mocks.post.mockImplementation(async (url: string) => {
      if (url === '/studio/samples') return { data: { sourceId: 4 } };
      if (url === '/studio/proposals') return { data: proposal() };
      saves += 1;
      if (saves === 1) throw new Error('response lost');
      return { data: { dashboardId: 9 } };
    });
    await ready();
    const questionKey = creationQuestionKey(await creationConfirmationKey());
    await waitFor(() => expect(readCreationQuestion(questionKey)?.prompt).toBe('총매출을 보여 줘'));
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
    await screen.findByRole('alert');
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '같은 저장 요청 확인' }) as HTMLButtonElement).disabled).toBe(false),
    );
    // UC-031: uncertainty keeps the reviewed proposal frozen until this exact save is confirmed.
    const originalBody = JSON.parse(JSON.stringify(mocks.post.mock.calls.find(c => c[0] === '/studio/dashboards')[1]));
    expect(saves).toBe(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    const prompt = screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement;
    expect(prompt.disabled).toBe(true);
    expect(prompt.value).toBe('총매출을 보여 줘');
    expect(screen.getByText('500')).toBeTruthy();
    for (const name of ['파일 선택', '매출·환불 샘플', 'Rill 광고 샘플', '지표와 차트 제안', '수정안 미리보기'])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '저장된 데이터' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '생성안 수정 요청' }) as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/9/studio'));
    expect(readCreationQuestion(questionKey)).toBeNull();
    const calls = mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards');
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toEqual(originalBody);
    expect(calls[1][1]).toEqual({
      requestId: '11111111-1111-4111-8111-111111111111',
      proposalId: 'proposal-1',
      expectedSourceRevision: 'a'.repeat(64),
    });
  });
  it('UC032 restores only the pending question and exact save after remount, without automatic requests', async () => {
    let writes = 0;
    mocks.post.mockImplementation(async (url: string) => {
      if (url === '/studio/samples') return { data: { sourceId: 4 } };
      if (url === '/studio/proposals') return { data: proposal() };
      writes += 1;
      if (writes === 1) throw new Error('response lost');
      return { data: { dashboardId: 9 } };
    });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
    await screen.findByRole('button', { name: '같은 저장 요청 확인' });
    const originalBody = JSON.parse(JSON.stringify(mocks.post.mock.calls.find(c => c[0] === '/studio/dashboards')[1]));
    const key = await creationConfirmationKey();
    expect(JSON.parse(sessionStorage.getItem(key)).request).toEqual(originalBody);
    cleanup();
    const postCount = mocks.post.mock.calls.length;
    render(<StudioCreate />);
    await screen.findByText('저장 요청과 질문을 복구했습니다');
    expect(screen.getByText('총매출을 보여 줘')).toBeTruthy();
    expect(screen.queryByText('500')).toBeNull();
    expect(mocks.post).toHaveBeenCalledTimes(postCount);
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/9/studio'));
    expect(mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards').map(c => c[1])).toEqual([
      originalBody,
      originalBody,
    ]);
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it('UC032 blocks saving before POST if the tab cannot retain its confirmation record', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    const original = Storage.prototype.setItem;
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.endsWith(':studio-create-save')) throw new Error('quota');
      return original.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
    await screen.findByText(/저장 요청을 보내지 않았습니다/);
    expect(mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards')).toHaveLength(0);
    expect(screen.getByText('500')).toBeTruthy();
    storage.mockRestore();
  });
  it('UC032 preserves the original record after a confirmation error and supports explicit local discard', async () => {
    const key = await creationConfirmationKey();
    const record = {
      version: 1 as const,
      updatedAt: Date.now(),
      sourceId: 4,
      title: 'Pending',
      prompt: 'Question',
      request: { requestId: 'save-one', proposalId: 'p-one', expectedSourceRevision: 'a'.repeat(64) },
    };
    writeCreationConfirmation(key, record);
    mocks.post.mockRejectedValueOnce({ response: { status: 503 } });
    render(<StudioCreate />);
    await screen.findByText('저장 요청과 질문을 복구했습니다');
    fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
    await screen.findByText(/저장 완료 여부를 확인하지 못했습니다/);
    expect(JSON.parse(sessionStorage.getItem(key))).toEqual(record);
    fireEvent.click(screen.getByRole('button', { name: '확인 대기 기록 지우기' }));
    await screen.findByText(/이미 저장된 대시보드는 유지됩니다/);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('UC032 does not disclose or replay a record whose source is no longer accessible', async () => {
    const key = await creationConfirmationKey();
    writeCreationConfirmation(key, {
      version: 1,
      updatedAt: Date.now(),
      sourceId: 99,
      title: 'Hidden title',
      prompt: 'Hidden question',
      request: { requestId: 'save-one', proposalId: 'p-one', expectedSourceRevision: 'a'.repeat(64) },
    });
    render(<StudioCreate />);
    await screen.findByText(/데이터 소스에 접근할 수 없습니다/);
    expect(screen.queryByText('Hidden title')).toBeNull();
    expect(screen.queryByText('Hidden question')).toBeNull();
    expect(screen.queryByRole('button', { name: '같은 저장 요청 확인' })).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('UC032 fences a restored request when a newer login replaces the session before confirmation', async () => {
    const key = await creationConfirmationKey();
    writeCreationConfirmation(key, {
      version: 1,
      updatedAt: Date.now(),
      sourceId: 4,
      title: 'Pending',
      prompt: 'Question',
      request: { requestId: 'save-one', proposalId: 'p-one', expectedSourceRevision: 'a'.repeat(64) },
    });
    render(<StudioCreate />);
    await screen.findByText('저장 요청과 질문을 복구했습니다');
    // A second tab's new login rotates the shared scope without clearing this tab's record.
    localStorage.removeItem('vm:editor-draft-auth:v1');
    localStorage.setItem('accessToken', JSON.stringify('unit-new-login'));
    fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
    await screen.findByText(/로그인 범위가 바뀌었습니다/);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(key)).not.toBeNull();
  });
  it('UC032 keeps a pending record and blocks replacement creation when initial permission lookup fails', async () => {
    const key = await creationConfirmationKey();
    const record = {
      version: 1 as const,
      updatedAt: Date.now(),
      sourceId: 4,
      title: 'Pending',
      prompt: 'Question',
      request: { requestId: 'save-one', proposalId: 'p-one', expectedSourceRevision: 'a'.repeat(64) },
    };
    writeCreationConfirmation(key, record);
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    render(<StudioCreate />);
    await screen.findByRole('button', { name: '저장 확인 상태 다시 불러오기' });
    expect(JSON.parse(sessionStorage.getItem(key))).toEqual(record);
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.queryByText('Question')).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('cancels a pending proposal and discards its delayed response', async () => {
    let resolve: (value: any) => void = () => {
      throw new Error('missing pending');
    };
    mocks.post.mockImplementation(async (url: string) =>
      url === '/studio/samples'
        ? { data: { sourceId: 4 } }
        : new Promise(r => {
            resolve = r;
          }),
    );
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    fireEvent.click(await screen.findByRole('button', { name: '생성 중지' }));
    await act(async () => {
      resolve({ data: proposal() });
    });
    expect(screen.queryByText('500')).toBeNull();
    expect(screen.getByText('생성을 취소했습니다. 데이터와 입력은 유지됩니다.')).toBeTruthy();
  });
  it('waits for recovery lookup before allowing a new sample, then uses the selected sample', async () => {
    mocks.params = 'sourceId=5';
    let first = true;
    let finishInitial: (value: any) => void = () => {
      throw new Error('missing list');
    };
    const original = mocks.get.getMockImplementation();
    mocks.get.mockImplementation((url: string, ...args: any[]) => {
      if (url === '/bi/sources' && first) {
        first = false;
        return new Promise(resolve => {
          finishInitial = resolve;
        });
      }
      return original?.(url, ...args);
    });
    const rendered = ready();
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.post).not.toHaveBeenCalled();
    await act(async () => {
      finishInitial({
        data: {
          status: 'SUCCESS',
          data: [
            { id: 4, name: 'Orders 4', engine: 'duckdb' },
            { id: 5, name: 'Orders 5', engine: 'duckdb' },
          ],
        },
      });
    });
    await rendered;
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    const calls = mocks.post.mock.calls.filter(call => call[0] === '/studio/proposals');
    expect(calls[0][1].sourceId).toBe(4);
  });
  it('keeps a clarification and its pinned source version after a failed submission', async () => {
    const unclear: any = proposal();
    delete unclear.preview;
    unclear.semanticProposal = [];
    unclear.clarifications = [
      {
        id: 'refundDenominator',
        question: '환불률 분모를 확인해 주세요.',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
        affectedBlockIds: [],
      },
    ];
    let calls = 0;
    mocks.post.mockImplementation(async (url: string) => {
      if (url === '/studio/samples') return { data: { sourceId: 4 } };
      calls += 1;
      if (calls === 1) return { data: unclear };
      throw { response: { status: 503 } };
    });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('계산 전에 확인해 주세요');
    fireEvent.change(screen.getByRole('combobox', { name: '환불률 분모' }), { target: { value: 'orders' } });
    fireEvent.click(screen.getByRole('button', { name: '의미 확인 후 다시 제안' }));
    await screen.findByText(/AI 연결 또는 처리 상태/);
    expect(screen.getByRole('combobox', { name: '환불률 분모' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: '환불률 분모' }), { target: { value: 'amount' } });
    fireEvent.click(screen.getByRole('button', { name: '의미 확인 후 다시 제안' }));
    await waitFor(() => expect(mocks.post.mock.calls.filter(call => call[0] === '/studio/proposals')).toHaveLength(3));
    expect(mocks.post.mock.calls.filter(call => call[0] === '/studio/proposals')[2][1]).toMatchObject({
      clarificationAnswers: { refundDenominator: 'amount' },
      expectedSourceRevision: 'a'.repeat(64),
    });
  });
  it('REFINE preserves the proposal while composing, saves only the latest validated refinement', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    const next = proposal();
    next.proposalId = 'proposal-2';
    (next as any).parentProposalId = 'proposal-1';
    next.semanticProposal[0].title = '수정된 총매출';
    mocks.post.mockImplementation(async (url: string) => ({
      data: url === '/studio/proposals' ? next : { dashboardId: 10 },
    }));
    fireEvent.change(screen.getByRole('textbox', { name: '생성안 수정 요청' }), {
      target: { value: '총매출 제목을 수정된 총매출로 바꿔' },
    });
    expect(screen.getByText('500')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '수정안 미리보기' }));
    await screen.findByRole('heading', { name: '수정된 총매출' });
    expect(mocks.post.mock.calls.filter(c => c[0] === '/studio/proposals').at(-1)?.[1]).toMatchObject({
      parentProposalId: 'proposal-1',
      targetBlockIndex: 0,
    });
    expect(mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/10/studio'));
    expect(mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards')[0][1].proposalId).toBe('proposal-2');
  });
  it('REFINE failure and cancelled late response preserve the old preview and user input', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    mocks.post.mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.change(screen.getByRole('textbox', { name: '생성안 수정 요청' }), { target: { value: '평균 매출로 바꿔' } });
    fireEvent.click(screen.getByRole('button', { name: '수정안 미리보기' }));
    await screen.findByText(/AI 연결 또는 처리 상태/);
    expect(screen.getByText('500')).toBeTruthy();
    let resolve: (v: any) => void = () => {
      throw new Error('missing pending refinement');
    };
    mocks.post.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: '수정안 미리보기' }));
    fireEvent.click(await screen.findByRole('button', { name: '수정 중지' }));
    const late = proposal();
    late.title = '늦은 응답';
    (late as any).parentProposalId = 'proposal-1';
    await act(async () => {
      resolve({ data: late });
    });
    expect(screen.queryByText('늦은 응답')).toBeNull();
    expect(screen.getByText('500')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '생성안 수정 요청' }) as HTMLTextAreaElement).value).toBe(
      '평균 매출로 바꿔',
    );
  });
  it('REFINE resumes a cached conversation proposal without invoking AI or saving', async () => {
    mocks.params = 'sourceId=4&proposalId=proposal-1';
    const original = mocks.get.getMockImplementation();
    mocks.get.mockImplementation((url: string, ...args: any[]) =>
      url.startsWith('/studio/proposals/') ? Promise.resolve({ data: proposal() }) : original?.(url, ...args),
    );
    render(<StudioCreate />);
    await screen.findByText('500');
    expect(screen.getByRole('textbox', { name: '생성안 수정 요청' })).toBeTruthy();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('A6 restores the original question for a new preview only after a definitive unavailable proposal', async () => {
    const key = await creationConfirmationKey();
    writeCreationConfirmation(key, {
      version: 1,
      updatedAt: Date.now(),
      sourceId: 4,
      title: '매출 요약',
      prompt: '총매출을 보여줘',
      request: { requestId: 'old-request', proposalId: 'old-proposal', expectedSourceRevision: 'a'.repeat(64) },
    });
    mocks.post.mockRejectedValueOnce({
      response: { status: 400, data: { success: false, code: 400, data: { code: 'STUDIO_CREATION_REPROPOSE_REQUIRED' } } },
    });
    render(<StudioCreate />);
    fireEvent.click(await screen.findByRole('button', { name: '같은 저장 요청 확인' }));
    fireEvent.click(await screen.findByRole('button', { name: '질문을 유지하고 새 제안 준비' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '지표와 차트 제안' }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe(
      '총매출을 보여줘',
    );
    expect(sessionStorage.getItem(String(key))).toBeNull();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '지표와 차트 제안' }));
    await screen.findByText('500');
    expect(mocks.post.mock.calls.at(-1)?.[1]).toEqual({ sourceId: 4, prompt: '총매출을 보여줘' });
    mocks.post.mockResolvedValueOnce({ data: { dashboardId: 10 } });
    fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/10/studio'));
    expect(mocks.post.mock.calls.at(-1)?.[1].requestId).not.toBe('old-request');
  });
  it.each([400, 403, 409, 503])('A6 never offers a new request on generic status %s', async status => {
    const key = await creationConfirmationKey();
    writeCreationConfirmation(key, {
      version: 1,
      updatedAt: Date.now(),
      sourceId: 4,
      title: '保留',
      prompt: '質問',
      request: { requestId: 'held', proposalId: 'held', expectedSourceRevision: 'a'.repeat(64) },
    });
    mocks.post.mockRejectedValueOnce({ response: { status } });
    render(<StudioCreate />);
    fireEvent.click(await screen.findByRole('button', { name: '같은 저장 요청 확인' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: '질문을 유지하고 새 제안 준비' })).toBeNull();
    expect(sessionStorage.getItem(String(key))).not.toBeNull();
  });
  it('restores a cached clarification question for answering without retyping or model invocation', async () => {
    mocks.params = 'sourceId=4&proposalId=clarify-parent';
    const unclear: any = proposal();
    delete unclear.preview;
    unclear.semanticProposal = [];
    unclear.requestPrompt = '환불률을 보여줘';
    unclear.clarifications = [
      {
        id: 'refundDenominator',
        question: '분모는?',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
        affectedBlockIds: [],
      },
    ];
    const original = mocks.get.getMockImplementation();
    mocks.get.mockImplementation((url: string, ...args: any[]) =>
      url.startsWith('/studio/proposals/') ? Promise.resolve({ data: unclear }) : original?.(url, ...args),
    );
    render(<StudioCreate />);
    fireEvent.change(await screen.findByRole('combobox', { name: '환불률 분모' }), { target: { value: 'amount' } });
    expect(mocks.post).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '의미 확인 후 다시 제안' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: '의미 확인 후 다시 제안' }));
    await screen.findByText('500');
    expect(mocks.post.mock.calls[0][1]).toMatchObject({
      prompt: '환불률을 보여줘',
      clarificationAnswers: { refundDenominator: 'amount' },
    });
  });
});

it('connects a newly prepared source without refetching the source index', async () => {
  let listCalls = 0;
  mocks.get.mockImplementation(async (url: string) => {
    if (url === '/bi/sources') {
      listCalls += 1;
      if (listCalls > 1) throw new Error('index unavailable');
      return { data: [{ id: 4, name: 'Orders 4', engine: 'duckdb' }] };
    }
    return { data: url.startsWith('/bi/metrics') ? [] : profile(6) };
  });
  mocks.post.mockResolvedValue({ data: { sourceId: 6 } });
  render(<StudioCreate />);
  await screen.findByRole('option', { name: 'Orders 4' });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.change(screen.getByRole('textbox', { name: '만들 대시보드 요청' }), { target: { value: '총매출을 보여 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '매출·환불 샘플' }));
  await screen.findByText('2행 · 1개 열 · 서버 DuckDB');
  expect((screen.getByRole('combobox', { name: '저장된 데이터' }) as HTMLSelectElement).value).toBe('6');
  expect((screen.getByRole('button', { name: '지표와 차트 제안' }) as HTMLButtonElement).disabled).toBe(false);
  expect(listCalls).toBe(1);
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.get.mock.calls.some(([url]) => url === '/bi/sources/6/profile')).toBe(true);
});

it('rechecks a prepared source after a profile failure without creating it again', async () => {
  let profileCalls = 0;
  mocks.get.mockImplementation(async (url: string) => {
    if (url === '/bi/sources') return { data: [{ id: 4, name: 'Orders 4', engine: 'duckdb' }] };
    if (url.startsWith('/bi/metrics')) return { data: [] };
    profileCalls += 1;
    if (profileCalls === 1) throw { response: { status: 503 } };
    return { data: profile(6) };
  });
  mocks.post.mockResolvedValue({ data: { sourceId: 6 } });
  render(<StudioCreate />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '매출·환불 샘플' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.change(screen.getByRole('textbox', { name: '만들 대시보드 요청' }), { target: { value: '총매출을 보여 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '매출·환불 샘플' }));
  const retry = await screen.findByRole('button', { name: '소스 새로 확인' });
  await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByRole('button', { name: '지표와 차트 제안' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('option', { name: 'Orders 6' })).toBeNull();
  fireEvent.click(retry);
  await screen.findByText('2행 · 1개 열 · 서버 DuckDB');
  expect((screen.getByRole('combobox', { name: '저장된 데이터' }) as HTMLSelectElement).value).toBe('6');
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe(
    '총매출을 보여 줘',
  );
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(profileCalls).toBe(2);
});

it('UC048 offers explicit question recovery after source access and never posts automatically', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  writeCreationQuestion(key, { sourceId: 4, prompt: 'recover this question' });
  render(<StudioCreate />);
  const restore = await screen.findByRole('button', { name: '새 생성 질문 복구' });
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(restore);
  await screen.findByText(/2행 · 1개 열 · 서버 DuckDB/);
  await waitFor(() =>
    expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe(
      'recover this question',
    ),
  );
  expect((screen.getByRole('combobox', { name: '저장된 데이터' }) as HTMLSelectElement).value).toBe('4');
  expect(mocks.post).not.toHaveBeenCalled();
  expect(readCreationQuestion(key)?.prompt).toBe('recover this question');
});
it('UC048 preserves inaccessible questions without disclosing or restoring them', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  writeCreationQuestion(key, { sourceId: 99, prompt: 'private question' });
  render(<StudioCreate />);
  const restore = await screen.findByRole('button', { name: '새 생성 질문 복구' });
  expect((restore as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('private question')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '보관 생성 질문 폐기' }));
  expect(readCreationQuestion(key)).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('UC048 retains typed input through remount and requires explicit recovery', async () => {
  await ready();
  const key = creationQuestionKey(await creationConfirmationKey());
  await waitFor(() => expect(readCreationQuestion(key)).toEqual({ sourceId: 4, prompt: '총매출을 보여 줘' }));
  cleanup();
  mocks.post.mockClear();
  render(<StudioCreate />);
  await screen.findByRole('button', { name: '새 생성 질문 복구' });
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '새 생성 질문 복구' }));
  await waitFor(() =>
    expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe(
      '총매출을 보여 줘',
    ),
  );
  expect(mocks.post).not.toHaveBeenCalled();
});
it('UC048 leaves explicit source links and old questions untouched', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  writeCreationQuestion(key, { sourceId: 4, prompt: 'old question' });
  mocks.params = 'sourceId=5';
  render(<StudioCreate />);
  await screen.findByText('Orders 5', { selector: 'strong' });
  expect(screen.queryByRole('button', { name: '새 생성 질문 복구' })).toBeNull();
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  expect(readCreationQuestion(key)?.prompt).toBe('old question');
  expect(mocks.post).not.toHaveBeenCalled();
});
it('UC048 keeps a recovery record when source access fails at explicit restore', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  writeCreationQuestion(key, { sourceId: 4, prompt: 'keep privately' });
  const fallback = mocks.get.getMockImplementation();
  mocks.get.mockImplementation(async (url: string, ...args: any[]) => {
    if (url.endsWith('/profile')) throw { response: { status: 403 } };
    return fallback(url, ...args);
  });
  render(<StudioCreate />);
  fireEvent.click(await screen.findByRole('button', { name: '새 생성 질문 복구' }));
  await screen.findByText('이 데이터 소스를 사용할 권한이 없습니다. 다른 소스를 선택해 주세요.');
  expect(readCreationQuestion(key)?.prompt).toBe('keep privately');
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
});

it('UC048 does not clear an unrelated question when a direct proposal is saved', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  writeCreationQuestion(key, { sourceId: 5, prompt: 'another source question' });
  mocks.params = 'sourceId=4&proposalId=parent';
  const fallback = mocks.get.getMockImplementation();
  mocks.get.mockImplementation(async (url: string, ...args: any[]) =>
    url === '/studio/proposals/parent'
      ? { data: { ...proposal(), requestPrompt: 'from direct link' } }
      : fallback(url, ...args),
  );
  mocks.post.mockResolvedValue({ data: { dashboardId: 9 } });
  render(<StudioCreate />);
  await screen.findByText('500');
  fireEvent.click(screen.getByRole('button', { name: 'Studio에 저장하고 열기' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/9/studio'));
  expect(readCreationQuestion(key)).toEqual({ sourceId: 5, prompt: 'another source question' });
});

it('UC048 A3 explicitly restores only the question against a different verified source', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  const record = { sourceId: 99, prompt: '보관한 질문' };
  writeCreationQuestion(key, record);
  render(<StudioCreate />);
  await screen.findByRole('button', { name: '새 생성 질문 복구' });
  fireEvent.change(screen.getByRole('combobox', { name: '저장된 데이터' }), { target: { value: '5' } });
  const restore = await screen.findByRole('button', { name: '선택한 데이터로 질문 복구' });
  expect(readCreationQuestion(key)).toEqual(record);
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  const calls = mocks.get.mock.calls.filter(call => call[0] === '/bi/sources/5/profile').length;
  fireEvent.click(restore);
  await waitFor(() =>
    expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe(record.prompt),
  );
  expect(mocks.get.mock.calls.filter(call => call[0] === '/bi/sources/5/profile')).toHaveLength(calls + 1);
  await waitFor(() => expect(readCreationQuestion(key)).toEqual({ sourceId: 5, prompt: record.prompt }));
  expect(mocks.post).not.toHaveBeenCalled();
});

it('UC048 A3 preserves the original record after replacement access fails and supports explicit retry', async () => {
  const key = creationQuestionKey(await creationConfirmationKey());
  const record = { sourceId: 99, prompt: '보존할 질문' };
  writeCreationQuestion(key, record);
  render(<StudioCreate />);
  await screen.findByRole('button', { name: '새 생성 질문 복구' });
  fireEvent.change(screen.getByRole('combobox', { name: '저장된 데이터' }), { target: { value: '5' } });
  const restore = await screen.findByRole('button', { name: '선택한 데이터로 질문 복구' });
  const fallback = mocks.get.getMockImplementation();
  mocks.get.mockImplementation(async (url: string, ...args: any[]) => {
    if (url === '/bi/sources/5/profile') throw { response: { status: 403 } };
    return fallback(url, ...args);
  });
  fireEvent.click(restore);
  await screen.findByText('이 데이터 소스를 사용할 권한이 없습니다. 다른 소스를 선택해 주세요.');
  expect(readCreationQuestion(key)).toEqual(record);
  expect((screen.getByRole('textbox', { name: '만들 대시보드 요청' }) as HTMLTextAreaElement).value).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
  mocks.get.mockImplementation(fallback);
  fireEvent.change(screen.getByRole('combobox', { name: '저장된 데이터' }), { target: { value: '4' } });
  fireEvent.click(await screen.findByRole('button', { name: '선택한 데이터로 질문 복구' }));
  await waitFor(() => expect(readCreationQuestion(key)).toEqual({ sourceId: 4, prompt: record.prompt }));
});
