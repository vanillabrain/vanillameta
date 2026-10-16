import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import StudioCreate from './StudioCreate';
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
  vi.clearAllMocks();
  mocks.params = '';
  vi.stubGlobal('crypto', { randomUUID: () => 'request-create-1' });
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
  fireEvent.click(screen.getByRole('button', { name: '매출·환불 샘플' }));
  await screen.findByText('2행 · 1개 열 · 서버 DuckDB');
  fireEvent.change(screen.getByRole('textbox', { name: '만들 대시보드 요청' }), { target: { value: '총매출을 보여 줘' } });
};
describe('Studio create workflow', () => {
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
    const calls = mocks.post.mock.calls.filter(c => c[0] === '/studio/dashboards');
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toEqual(originalBody);
    expect(calls[1][1]).toEqual({
      requestId: 'request-create-1',
      proposalId: 'proposal-1',
      expectedSourceRevision: 'a'.repeat(64),
    });
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
  it('ignores delayed initial URL selection after a newer sample and proposal started', async () => {
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
    await ready();
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
});
