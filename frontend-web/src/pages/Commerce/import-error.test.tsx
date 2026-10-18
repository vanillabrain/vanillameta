import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Commerce from './index';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  postForm: vi.fn(),
  put: vi.fn(),
  params: {} as Record<string, string>,
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('@/helpers/apiHelper', () => ({
  get: mocks.get,
  post: mocks.post,
  postForm: mocks.postForm,
  put: mocks.put,
}));
vi.mock('@/pages/Dashboard/Components/AiDashboardPanel', () => ({
  default: ({ open, onClose }: any) =>
    open ? (
      <div role="dialog" aria-label="AI 분석 만들기">
        <button onClick={onClose}>분석 닫기</button>
      </div>
    ) : null,
}));
vi.mock('echarts-for-react', () => ({ default: () => null }));
vi.mock('@/components/PageTitleBox', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
const REQUEST_ID = '3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const diagnostic = {
  requestId: REQUEST_ID,
  errorCode: 'IMPORT_INVALID_DATE',
  stage: 'commerce-import',
  version: 1,
  target: 'commerce-bundle',
  dataHealth: 'unverified',
};
const importFailure = () => ({
  response: {
    status: 400,
    data: { success: false, code: 400, data: { message: 'raw internal detail rowId 42', diagnostic } },
  },
});
const helpOk = (explanation: string) => ({
  data: {
    status: 'SUCCESS',
    data: { requestId: REQUEST_ID, explanation, actions: ['reselect-files'], dataHealth: 'unverified' },
  },
});
const csvFile = (name: string) => {
  const file = new File(['a,b\n1,2'], name, { type: 'text/csv' });
  Object.defineProperty(file, 'slice', { value: () => ({ text: () => Promise.resolve('a,b\n1,2') }) });
  return file;
};
const reportPayload = {
  project: { id: 7, name: '기존 프로젝트' },
  summary: { paymentTotal: 100, refundTotal: 10, netCollected: 90, paidOrders: 2, refundedOrders: 1, refundOrderRate: 0.5 },
  daily: [{ date: '2024-01-31', paymentTotal: 100, refundTotal: 10, netCollected: 90 }],
  channels: [{ channel: 'direct', paymentTotal: 100, refundTotal: 10, netCollected: 90 }],
  reasons: [{ reason: 'damaged', refundTotal: 10, refunds: 1 }],
  orders: [
    {
      orderId: 'o1',
      orderedAt: '2024-01-31T00:00:00Z',
      channel: 'direct',
      orderStatus: 'completed',
      paidAmount: 100,
      refundAmount: 10,
      netCollected: 90,
    },
  ],
  availableChannels: ['direct'],
};
const pendingUpload = () => {
  let reject: (value: unknown) => void = () => undefined;
  mocks.postForm.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectUpload) => {
        reject = rejectUpload;
      }),
  );
  return () => reject;
};
const projectAndReport = (url: string) => {
  if (url === '/commerce/7/report') return Promise.resolve({ data: { status: 'SUCCESS', data: reportPayload } });
  return Promise.resolve({ data: { status: 'SUCCESS', data: [{ id: 7, name: '기존 프로젝트' }] } });
};
const pickFile = (label: string, name: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { files: [csvFile(name)] } });
const helpButton = () => screen.queryByRole('button', { name: 'AI로 오류 설명 보기' });
const importBundle = async () => {
  fireEvent.change(screen.getByLabelText('프로젝트 이름'), { target: { value: '테스트 프로젝트' } });
  pickFile('주문 CSV 파일 선택', 'orders.csv');
  pickFile('결제 CSV 파일 선택', 'payments.csv');
  pickFile('환불 CSV 파일 선택', 'refunds.csv');
  fireEvent.click(screen.getByRole('button', { name: 'CSV 가져오기' }));
  await screen.findByText(/CSV 가져오기에 실패했습니다/);
};
beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.postForm.mockReset();
  mocks.put.mockReset();
  mocks.params = {};
  mocks.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [] } });
});
afterEach(cleanup);

it('shows fixed safe copy and offers help only on an explicit click', async () => {
  mocks.postForm.mockRejectedValueOnce(importFailure());
  render(<Commerce />);
  await importBundle();
  expect(screen.getByText(/CSV 가져오기에 실패했습니다/)).toBeTruthy();
  expect(screen.queryByText(/raw internal detail/)).toBeNull();
  expect(screen.queryByText(/rowId/)).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
  mocks.post.mockResolvedValueOnce(helpOk('날짜 열에 잘못된 값이 있습니다.'));
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText('날짜 열에 잘못된 값이 있습니다.');
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post.mock.calls[0][0]).toBe('/commerce/import-help');
  expect(mocks.post.mock.calls[0][1]).toEqual({ requestId: REQUEST_ID });
  expect(mocks.post.mock.calls[0][2]).toMatchObject({ timeout: 120000, signal: expect.any(AbortSignal) });
  fireEvent.click(screen.getByRole('button', { name: '파일 다시 선택' }));
  expect(mocks.postForm).toHaveBeenCalledTimes(1);
});

it('keeps manual file recovery while a new import aborts pending help', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.postForm.mockRejectedValueOnce(importFailure());
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  render(<Commerce />);
  await importBundle();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  mocks.postForm.mockRejectedValueOnce(importFailure());
  fireEvent.click(screen.getByRole('button', { name: 'CSV 가져오기' }));
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => {
    resolveHelp(helpOk('늦게 도착한 설명'));
  });
  expect(screen.queryByText('늦게 도착한 설명')).toBeNull();
  expect(screen.getByRole('button', { name: '주문 CSV 선택' })).toBeTruthy();
  expect(screen.getByLabelText('주문 CSV 파일 선택')).toBeTruthy();
});

it('clears the help offer when a file is reselected after a help failure', async () => {
  mocks.postForm.mockRejectedValueOnce(importFailure());
  mocks.post.mockRejectedValueOnce(new Error('ai unavailable'));
  render(<Commerce />);
  await importBundle();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.getByRole('button', { name: 'CSV 가져오기' })).toBeTruthy();
  pickFile('주문 CSV 파일 선택', 'orders-2.csv');
  await waitFor(() => expect(helpButton()).toBeNull());
});

it('shows fixed required-header guidance and keeps reselect available before and after AI help', async () => {
  mocks.postForm.mockRejectedValueOnce(importFailure());
  render(<Commerce />);
  await importBundle();
  expect(screen.getByText(/order_total/)).toBeTruthy();
  expect(screen.getByText(/refund_reason/)).toBeTruthy();
  expect(screen.getByText(/acquisition_channel/)).toBeTruthy();
  expect(screen.getAllByText(/2024-01-31T00:00:00Z/).length).toBeGreaterThan(0);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '파일 다시 선택' })).toBeTruthy();
  mocks.post.mockRejectedValueOnce(new Error('ai unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.getByRole('button', { name: '파일 다시 선택' })).toBeTruthy();
});

it('discards a pending upload rejection after the file selection changes', async () => {
  const rejectUpload = pendingUpload();
  render(<Commerce />);
  fireEvent.change(screen.getByLabelText('프로젝트 이름'), { target: { value: '테스트 프로젝트' } });
  pickFile('주문 CSV 파일 선택', 'orders.csv');
  pickFile('결제 CSV 파일 선택', 'payments.csv');
  pickFile('환불 CSV 파일 선택', 'refunds.csv');
  fireEvent.click(screen.getByRole('button', { name: 'CSV 가져오기' }));
  expect(mocks.postForm).toHaveBeenCalledTimes(1);
  pickFile('주문 CSV 파일 선택', 'orders-2.csv');
  await act(async () => {
    rejectUpload()(importFailure());
  });
  expect(screen.queryByText(/CSV 가져오기에 실패했습니다/)).toBeNull();
  expect(helpButton()).toBeNull();
  expect((screen.getByRole('button', { name: 'CSV 가져오기' }) as HTMLButtonElement).disabled).toBe(false);
});

it('discards a pending upload rejection when the route changes', async () => {
  const rejectUpload = pendingUpload();
  mocks.get.mockImplementation(projectAndReport);
  const view = render(<Commerce />);
  fireEvent.change(screen.getByLabelText('프로젝트 이름'), { target: { value: '테스트 프로젝트' } });
  pickFile('주문 CSV 파일 선택', 'orders.csv');
  pickFile('결제 CSV 파일 선택', 'payments.csv');
  pickFile('환불 CSV 파일 선택', 'refunds.csv');
  fireEvent.click(screen.getByRole('button', { name: 'CSV 가져오기' }));
  expect(mocks.postForm).toHaveBeenCalledTimes(1);
  mocks.params = { projectId: '7' };
  view.rerender(<Commerce />);
  await act(async () => {
    rejectUpload()(importFailure());
  });
  expect(screen.queryByText(/CSV 가져오기에 실패했습니다/)).toBeNull();
  expect(helpButton()).toBeNull();
});

it('reopens the collapsed import card and triggers the file input on reselect', async () => {
  mocks.get.mockImplementation(projectAndReport);
  mocks.params = { projectId: '7' };
  mocks.postForm.mockRejectedValueOnce(importFailure());
  render(<Commerce />);
  fireEvent.click(await screen.findByRole('button', { name: '데이터 가져오기 / 교체' }));
  pickFile('주문 CSV 파일 선택', 'orders.csv');
  pickFile('결제 CSV 파일 선택', 'payments.csv');
  pickFile('환불 CSV 파일 선택', 'refunds.csv');
  fireEvent.click(screen.getByRole('button', { name: 'CSV 가져오기' }));
  await screen.findByText(/CSV 가져오기에 실패했습니다/);
  fireEvent.click(screen.getByRole('button', { name: '데이터 가져오기 닫기' }));
  expect(screen.queryByLabelText('주문 CSV 파일 선택')).toBeNull();
  const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
  fireEvent.click(screen.getByRole('button', { name: '파일 다시 선택' }));
  await waitFor(() => expect(screen.getByLabelText('주문 CSV 파일 선택')).toBeTruthy());
  expect(clickSpy).toHaveBeenCalledTimes(1);
  clickSpy.mockRestore();
});

it('offers analysis creation separately from commerce presentation editing', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  render(<Commerce />);
  await screen.findByRole('button', { name: 'AI로 설명·제목 편집' });
  fireEvent.click(screen.getByRole('button', { name: 'AI 분석 만들기' }));
  expect(screen.getByRole('dialog', { name: 'AI 분석 만들기' })).toBeTruthy();
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '분석 닫기' }));
  expect(screen.queryByRole('dialog', { name: 'AI 분석 만들기' })).toBeNull();
});

it('shows initial report loading and retries a failed first query without requiring existing results', async () => {
  mocks.params = { projectId: '7' };
  let rejectFirst: (error: unknown) => void = () => undefined;
  let resolveRetry: (value: unknown) => void = () => undefined;
  let reportRequests = 0;
  mocks.get.mockImplementation((url: string) => {
    if (url !== '/commerce/7/report') return projectAndReport(url);
    reportRequests += 1;
    return new Promise((resolve, reject) => {
      if (reportRequests === 1) rejectFirst = reject;
      else resolveRetry = resolve;
    });
  });
  render(<Commerce />);
  expect(await screen.findByText('리포트를 불러오는 중…')).toBeTruthy();
  expect(screen.queryByText('결제 성공액')).toBeNull();
  await act(async () => rejectFirst({ response: { status: 503, data: { message: '조회 서버 오류' } } }));
  expect(await screen.findByText('조회 서버 오류')).toBeTruthy();
  expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '리포트 다시 불러오기' }));
  expect(reportRequests).toBe(2);
  expect(screen.getByText('리포트를 불러오는 중…')).toBeTruthy();
  expect(screen.queryByText('조회 서버 오류')).toBeNull();
  await act(async () => resolveRetry({ data: { status: 'SUCCESS', data: reportPayload } }));
  expect(await screen.findByText('결제 성공액')).toBeTruthy();
  expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
  expect(screen.queryByRole('button', { name: '리포트 다시 불러오기' })).toBeNull();
});

it('keeps existing results after a report failure and retries the selected channel', async () => {
  mocks.params = { projectId: '7' };
  let reportRequests = 0;
  mocks.get.mockImplementation((url: string) => {
    if (url === '/commerce/7/report') reportRequests += 1;
    if (url === '/commerce/7/report' && reportRequests === 2) {
      return Promise.reject({ response: { status: 503, data: { message: '재조회 서버 오류' } } });
    }
    return projectAndReport(url);
  });
  render(<Commerce />);
  await screen.findByText('결제 성공액');
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'direct' } });
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
  await screen.findByText(/재조회 서버 오류.*이전 결과/);
  expect(screen.getByText('o1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '리포트 다시 불러오기' }));
  await waitFor(() => expect(screen.queryByText(/재조회 서버 오류/)).toBeNull());
  expect(mocks.get).toHaveBeenLastCalledWith('/commerce/7/report', { channel: 'direct' });
  expect(screen.getByText('o1')).toBeTruthy();
});

it('clears report errors and ignores late report failures when leaving the project route', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(url =>
    url === '/commerce/7/report'
      ? Promise.reject({ response: { status: 503, data: { message: '지난 프로젝트 오류' } } })
      : projectAndReport(url),
  );
  const view = render(<Commerce />);
  await screen.findByText('지난 프로젝트 오류');
  mocks.params = {};
  view.rerender(<Commerce />);
  await waitFor(() => expect(screen.queryByText('지난 프로젝트 오류')).toBeNull());
  expect(screen.queryByRole('button', { name: '리포트 다시 불러오기' })).toBeNull();

  let rejectLate: (error: unknown) => void = () => undefined;
  mocks.get.mockImplementation(url =>
    url === '/commerce/7/report'
      ? new Promise((_resolve, reject) => {
          rejectLate = reject;
        })
      : projectAndReport(url),
  );
  mocks.params = { projectId: '7' };
  view.rerender(<Commerce />);
  await screen.findByText('리포트를 불러오는 중…');
  mocks.params = {};
  view.rerender(<Commerce />);
  await act(async () => rejectLate({ response: { status: 503, data: { message: '늦은 프로젝트 오류' } } }));
  expect(screen.queryByText('늦은 프로젝트 오류')).toBeNull();
  expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
});

it.each(['success', 'error'] as const)(
  'keeps the newest filter result when an older request finishes with %s',
  async outcome => {
    mocks.params = { projectId: '7' };
    mocks.get.mockImplementation(projectAndReport);
    render(<Commerce />);
    await screen.findByText('결제 성공액');
    const pending: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];
    mocks.get.mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
    fireEvent.change(screen.getByLabelText('시작일 UTC'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('종료일 UTC'), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'direct' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.change(screen.getByLabelText('시작일 UTC'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText('종료일 UTC'), { target: { value: '2024-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(pending).toHaveLength(2);
    expect(mocks.get).toHaveBeenLastCalledWith('/commerce/7/report', {
      start: '2024-01-01',
      end: '2024-12-31',
      channel: 'direct',
    });
    await act(async () =>
      pending[1].resolve({
        data: {
          data: {
            ...reportPayload,
            orders: [{ ...reportPayload.orders[0], orderId: 'LATEST-ORDER' }],
            scope: { start: '2024-01-01', end: '2024-12-31', channel: 'direct', timezone: 'UTC' },
          },
        },
      }),
    );
    await screen.findByText('LATEST-ORDER');
    await act(async () => {
      if (outcome === 'error') pending[0].reject({ response: { status: 503, data: { message: 'STALE-ERROR' } } });
      else
        pending[0].resolve({
          data: { data: { ...reportPayload, orders: [{ ...reportPayload.orders[0], orderId: 'STALE-ORDER' }] } },
        });
    });
    expect(screen.getByText('LATEST-ORDER')).toBeTruthy();
    expect(screen.queryByText(/STALE-/)).toBeNull();
    expect(screen.getByText(/표시 결과 범위: 2024-01-01 ~ 2024-12-31/)).toBeTruthy();
    expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
  },
);

it('keeps loading for the newest request when an older response arrives first', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  render(<Commerce />);
  await screen.findByText('결제 성공액');
  const pending: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];
  mocks.get.mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'direct' } });
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
  expect(pending).toHaveLength(2);
  await act(async () => pending[0].resolve({ data: { data: reportPayload } }));
  expect(screen.getByText('리포트를 불러오는 중…')).toBeTruthy();
  await act(async () => pending[1].reject({ response: { status: 503, data: { message: 'LATEST-ERROR' } } }));
  expect(await screen.findByText(/LATEST-ERROR/)).toBeTruthy();
  expect(screen.getByText('o1')).toBeTruthy();
  expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
});

// These cases cover retry/filter overlap beyond the plain filter races above.
const startReportRace = async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(url =>
    url === '/commerce/7/report'
      ? Promise.resolve({
          data: { data: { ...reportPayload, availableChannels: ['direct', 'partner'] } },
        })
      : projectAndReport(url),
  );
  render(<Commerce />);
  await screen.findByText('o1');
  const pending: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];
  mocks.get.mockImplementation((url: string) =>
    url === '/commerce/7/report'
      ? new Promise((resolve, reject) => pending.push({ resolve, reject }))
      : projectAndReport(url),
  );
  return pending;
};
const raceFilters = (year: string, channel: string) => {
  fireEvent.change(screen.getByLabelText('시작일 UTC'), { target: { value: `${year}-01-01` } });
  fireEvent.change(screen.getByLabelText('종료일 UTC'), { target: { value: `${year}-12-31` } });
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: channel } });
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
};
const raceResult = (orderId: string, year = '2025', channel = 'partner') => ({
  data: {
    data: {
      ...reportPayload,
      summary: { ...reportPayload.summary, paymentTotal: 777 },
      orders: [{ ...reportPayload.orders[0], orderId }],
      availableChannels: ['direct', 'partner'],
      scope: { start: `${year}-01-01`, end: `${year}-12-31`, channel, timezone: 'UTC' },
    },
  },
});
const raceFailure = (message: string) => ({ response: { status: 503, data: { message } } });

it.each(['success', 'error'] as const)(
  'preserves the newest failure and baseline after an older %s, then retries the newest filters',
  async outcome => {
    const pending = await startReportRace();
    raceFilters('2024', 'direct');
    raceFilters('2025', 'partner');
    expect(pending).toHaveLength(2);
    await act(async () => pending[1].reject(raceFailure('LATEST-ERROR')));
    const error = await screen.findByText(/LATEST-ERROR.*이전 결과/);
    const retainedScope = screen.getByText(/표시 결과 범위:/).textContent;
    await act(async () => {
      if (outcome === 'success') pending[0].resolve(raceResult('STALE-ORDER', '2024', 'direct'));
      else pending[0].reject(raceFailure('STALE-ERROR'));
    });
    expect(screen.getByText(/LATEST-ERROR.*이전 결과/)).toBe(error);
    expect(screen.getByText('o1')).toBeTruthy();
    expect(screen.queryByText(/STALE-/)).toBeNull();
    expect(screen.queryByText(/777/)).toBeNull();
    expect(screen.getByText(/표시 결과 범위:/).textContent).toBe(retainedScope);
    expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '리포트 다시 불러오기' }));
    expect(pending).toHaveLength(3);
    expect(mocks.get).toHaveBeenLastCalledWith('/commerce/7/report', {
      start: '2025-01-01',
      end: '2025-12-31',
      channel: 'partner',
    });
    expect(screen.getByText('리포트를 불러오는 중…')).toBeTruthy();
    expect(screen.getByText('o1')).toBeTruthy();
    expect(screen.queryByText(/LATEST-ERROR/)).toBeNull();
    await act(async () => pending[2].resolve(raceResult('RECOVERED-ORDER')));
    expect(await screen.findByText('RECOVERED-ORDER')).toBeTruthy();
    expect(screen.getByText(/777/)).toBeTruthy();
    expect(screen.queryByText('o1')).toBeNull();
    expect(screen.getByText(/표시 결과 범위: 2025-01-01 ~ 2025-12-31.*partner/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '리포트 다시 불러오기' })).toBeNull();
    expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
  },
);

it.each([
  ['success', 'before'],
  ['error', 'before'],
  ['success', 'after'],
  ['error', 'after'],
] as const)('ignores a superseded retry %s arriving %s the newest filter response', async (outcome, timing) => {
  const pending = await startReportRace();
  raceFilters('2024', 'direct');
  await act(async () => pending[0].reject(raceFailure('INITIAL-ERROR')));
  await screen.findByText(/INITIAL-ERROR/);
  fireEvent.click(screen.getByRole('button', { name: '리포트 다시 불러오기' }));
  expect(screen.queryByText(/INITIAL-ERROR/)).toBeNull();
  raceFilters('2025', 'partner');
  expect(pending).toHaveLength(3);
  expect((screen.getByRole('button', { name: '적용' }) as HTMLButtonElement).disabled).toBe(false);
  const retainedScope = screen.getByText(/표시 결과 범위:/).textContent;
  const settleRetry = () =>
    act(async () => {
      if (outcome === 'success') pending[1].resolve(raceResult('STALE-ORDER', '2024', 'direct'));
      else pending[1].reject(raceFailure('STALE-ERROR'));
    });
  if (timing === 'before') {
    await settleRetry();
    expect(screen.getByText('리포트를 불러오는 중…')).toBeTruthy();
    expect(screen.getByText('o1')).toBeTruthy();
    expect(screen.getByText(/표시 결과 범위:/).textContent).toBe(retainedScope);
    expect(screen.queryByText(/777/)).toBeNull();
    expect(screen.queryByRole('button', { name: '리포트 다시 불러오기' })).toBeNull();
    await act(async () => pending[2].reject(raceFailure('LATEST-ERROR')));
    await screen.findByText(/LATEST-ERROR.*이전 결과/);
    expect(screen.getByText('o1')).toBeTruthy();
    expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '리포트 다시 불러오기' }));
    expect(pending).toHaveLength(4);
    expect(mocks.get).toHaveBeenLastCalledWith('/commerce/7/report', {
      start: '2025-01-01',
      end: '2025-12-31',
      channel: 'partner',
    });
    await act(async () => pending[3].resolve(raceResult('LATEST-ORDER')));
  } else {
    await act(async () => pending[2].resolve(raceResult('LATEST-ORDER')));
    await screen.findByText('LATEST-ORDER');
    await settleRetry();
  }
  expect(screen.getByText('LATEST-ORDER')).toBeTruthy();
  expect(screen.getByText(/777/)).toBeTruthy();
  expect(screen.getByText(/표시 결과 범위: 2025-01-01 ~ 2025-12-31.*partner/)).toBeTruthy();
  expect(screen.queryByText(/STALE-|INITIAL-ERROR|LATEST-ERROR/)).toBeNull();
  expect(screen.queryByText('o1')).toBeNull();
  expect(screen.queryByText('리포트를 불러오는 중…')).toBeNull();
  expect(screen.queryByRole('button', { name: '리포트 다시 불러오기' })).toBeNull();
});

it('uses KRW for KPI, table names and unit descriptions without dollar labels', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation((url: string) =>
    url === '/commerce/7/report'
      ? Promise.resolve({
          data: {
            data: {
              ...reportPayload,
              scope: { currency: 'KRW' },
              summary: {
                ...reportPayload.summary,
                paymentTotal: '12000.00',
                refundTotal: '2000.00',
                netCollected: '10000.00',
              },
            },
          },
        })
      : projectAndReport(url),
  );
  render(<Commerce />);
  await screen.findByText('₩12,000');
  expect(screen.getByText('₩2,000')).toBeTruthy();
  expect(screen.getByText('₩10,000')).toBeTruthy();
  expect(screen.getByText('결제 이벤트 기준 · KRW')).toBeTruthy();
  expect(screen.queryByText('결제 이벤트 기준 · USD')).toBeNull();
});

it.each([
  ['mixed_currency', '통화별로 파일을 나눠 주세요.'],
  ['fractional_krw', 'KRW 금액은 소수 없이 원 단위여야 합니다.'],
])('shows safe currency guidance for %s without exposing row details', async (code, message) => {
  mocks.postForm.mockRejectedValueOnce({
    response: { data: { data: { validation: { errors: [{ code, rowId: 'private-row', detail: 'private-detail' }] } } } },
  });
  render(<Commerce />);
  await importBundle();
  expect(screen.getByText(new RegExp(message))).toBeTruthy();
  expect(screen.queryByText(/private-row|private-detail/)).toBeNull();
});

const studioButton = () => screen.findByRole('button', { name: /이 데이터로 Studio 만들기/ });
// Mirrors the real axios shape for POST /commerce/:id/studio-source: a Nest envelope inside the response body.
const studioSourceOk = (sourceId: number, status = 200) => ({
  status,
  data: {
    status: 'SUCCESS',
    data: { sourceId, commerceProjectId: 7, version: 3, currency: 'KRW', timeBasis: 'order-cohort' },
  },
});

it('creates a private Studio source from the ready report and navigates with the returned sourceId', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  mocks.post.mockResolvedValueOnce(studioSourceOk(42));
  render(<Commerce />);
  await studioButton();
  expect(screen.getByText(/전체 주문·주문일 기준 코호트\(UTC\)만 비공개 소스로 옮깁니다/)).toBeTruthy();
  expect(screen.getByText(/날짜·채널 필터는 전달되지 않으며, AI 요청과 저장은 Studio에서 직접 해야 합니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/studio/new?sourceId=42'));
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post).toHaveBeenCalledWith('/commerce/7/studio-source', undefined, { timeout: 120000 });
  expect(screen.queryByText(/Studio 소스를 만들지 못했습니다/)).toBeNull();
});

it('sends a single Studio source request when the action is clicked again while busy', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  let resolveSource: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => new Promise(resolve => (resolveSource = resolve)));
  render(<Commerce />);
  await studioButton();
  const button = screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(await screen.findByText('Studio 소스 만드는 중…')).toBeTruthy();
  expect(mocks.post).toHaveBeenCalledTimes(1);
  await act(async () => resolveSource(studioSourceOk(42)));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/studio/new?sourceId=42'));
  expect(mocks.post).toHaveBeenCalledTimes(1);
});

it('shows a fixed retry error and never navigates on a failed Studio source request', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  mocks.post.mockRejectedValueOnce({
    response: { status: 500, data: { message: 'internal detail 42', data: { diagnostics: 'private-detail' } } },
  });
  render(<Commerce />);
  await studioButton();
  fireEvent.click(screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ }));
  expect(await screen.findByText(/Studio 소스를 만들지 못했습니다/)).toBeTruthy();
  expect(screen.getByText(/같은 버튼을 다시 눌러 같은 보고서로 재시도할 수 있습니다/)).toBeTruthy();
  expect(screen.queryByText(/internal detail|private-detail/)).toBeNull();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.post).toHaveBeenCalledTimes(1);
  const button = await studioButton();
  expect(button.hasAttribute('disabled')).toBe(false);
  mocks.post.mockResolvedValueOnce(studioSourceOk(43, 201));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/studio/new?sourceId=43'));
  expect(mocks.post).toHaveBeenCalledTimes(2);
});

it('ignores a late Studio source response and never navigates for a nonpositive sourceId', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  let resolveSource: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => new Promise(resolve => (resolveSource = resolve)));
  const view = render(<Commerce />);
  await studioButton();
  fireEvent.click(screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ }));
  mocks.params = { projectId: '8' };
  mocks.get.mockImplementation(url =>
    url === '/commerce/8/report'
      ? Promise.resolve({ data: { status: 'SUCCESS', data: reportPayload } })
      : Promise.resolve({ data: { status: 'SUCCESS', data: [] } }),
  );
  view.rerender(<Commerce />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/commerce/8/report', {}));
  const lateNavigateCount = mocks.navigate.mock.calls.length;
  await act(async () => resolveSource(studioSourceOk(44)));
  await waitFor(() => expect(screen.queryByText('Studio 소스 만드는 중…')).toBeNull());
  expect(mocks.navigate.mock.calls.length).toBe(lateNavigateCount);
  expect(mocks.navigate).not.toHaveBeenCalledWith('/studio/new?sourceId=44');

  mocks.post.mockResolvedValueOnce(studioSourceOk(0));
  fireEvent.click(await studioButton());
  expect(await screen.findByText(/Studio 소스를 만들지 못했습니다/)).toBeTruthy();
  expect(mocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining('sourceId=0'));
});

it('drops a pending Studio source request when the view unmounts', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  let resolveSource: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => new Promise(resolve => (resolveSource = resolve)));
  const view = render(<Commerce />);
  await studioButton();
  fireEvent.click(screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ }));
  view.unmount();
  await act(async () => resolveSource(studioSourceOk(45)));
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it('navigates for the real raw response body and shows a fixed error for a mismatched status', async () => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  // Exact backend body plus HTTP status, matching the live POST /commerce/:id/studio-source response.
  mocks.post.mockResolvedValueOnce({
    status: 201,
    data: {
      status: 'SUCCESS',
      data: { sourceId: 4, commerceProjectId: 1, version: 1, currency: 'KRW', timeBasis: 'order-cohort' },
    },
  });
  render(<Commerce />);
  await studioButton();
  fireEvent.click(screen.getByRole('button', { name: /이 데이터로 Studio 만들기/ }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/studio/new?sourceId=4'));

  // A 2xx response that carries no usable sourceId must not navigate.
  mocks.get.mockImplementation(projectAndReport);
  mocks.post.mockResolvedValueOnce({ status: 200, data: { status: 'SUCCESS', data: { sourceId: 0 } } });
  fireEvent.click(await studioButton());
  expect(await screen.findByText(/Studio 소스를 만들지 못했습니다/)).toBeTruthy();
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
});

it.each([
  { status: 201, data: { status: 'ERROR', data: { sourceId: 42 } } },
  { status: 201, data: { status: 'SUCCESS', data: { sourceId: true } } },
])('never opens Studio for an app error or a nonnumeric source ID %#', async response => {
  mocks.params = { projectId: '7' };
  mocks.get.mockImplementation(projectAndReport);
  mocks.post.mockResolvedValueOnce(response);
  render(<Commerce />);
  fireEvent.click(await studioButton());
  await screen.findByText(/Studio 소스를 만들지 못했습니다/);
  expect(mocks.navigate).not.toHaveBeenCalled();
});
