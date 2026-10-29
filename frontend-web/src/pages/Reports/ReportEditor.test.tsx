import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ReportEditor from './ReportEditor';
import Reports from './Reports';
import { readReportPending, storeReportPending, ReportPending } from './reportPending';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  scope: 'A',
  key: vi.fn(
    async (token: string, dashboard: number) =>
      (api.scope === 'A' ? 'actor-org-epoch' : 'other-session') + (dashboard === 2 ? '' : ':' + dashboard),
  ),
}));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => api.scope }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftKey: api.key }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => 'session' }));
vi.mock('../Dashboard/Studio/PublishedBlockView', () => ({
  PublishedBlockView: ({ block }: any) => (
    <section>
      <h2>{block.title}</h2>
      <p>{JSON.stringify(block.datas)}</p>
    </section>
  ),
}));
const id = '12345678-1234-4234-8234-123456789abc';
const requestId = '22345678-1234-4234-8234-123456789abc';
const key = 'actor-org-epoch:private-report:none:new';
const snapshot = () => ({
  capturedAt: '2026-10-29T00:00:00Z',
  rendered: {
    title: 'Sales',
    periodLabel: '전체 기간',
    blocks: [
      {
        id: 'block-1',
        kind: 'BOARD_NUMERIC',
        title: '매출 KPI',
        description: '',
        display: {},
        valueField: 'value',
        fields: [{ columnName: 'value', columnType: 'number' }],
        datas: [{ value: '16537.01' }],
      },
      {
        id: 'block-2',
        kind: 'CHART_COLUMN',
        title: '채널 매출',
        description: '',
        display: {},
        valueField: 'value',
        categoryField: 'dimension',
        fields: [
          { columnName: 'value', columnType: 'number' },
          { columnName: 'dimension', columnType: 'string' },
        ],
        datas: [{ dimension: 'organic', value: '5954.96' }],
      },
    ],
  },
  basis: {
    dashboardId: 2,
    dashboardRevision: 'a'.repeat(64),
    source: { id: 1, revision: 'b'.repeat(64), schemaVersion: 'c'.repeat(64), dataVersion: 'd'.repeat(64) },
    selection: { kpiId: 'kpi', chartId: 'chart' },
    timeZone: 'UTC',
    definitions: [{ aggregation: 'SUM', column: 'net' }],
  },
});
const report = () => ({
  reportId: id,
  version: 1,
  title: '저장 보고서',
  body: '저장 본문',
  savedAt: '2026-10-29T00:01:00Z',
  revision: 'e'.repeat(64),
  organizationId: null,
  snapshot: snapshot(),
});
const ticket = (): ReportPending => ({
  version: 1,
  reportId: id,
  dashboardId: 2,
  updatedAt: Date.now(),
  command: {
    requestId,
    expectedOrganizationId: null,
    expectedRevision: null,
    title: '미확정 제목',
    body: '<script>본문 보존</script>',
    data: {
      mode: 'capture',
      capture: { dashboardId: 2, expectedDashboardRevision: 'a'.repeat(64), kpiId: 'kpi', chartId: 'chart' },
      previewDigest: 'f'.repeat(64),
    },
  },
});
const show = (url = '/reports/new?dashboardId=2') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reports/new" element={<ReportEditor />} />
        <Route path="/reports/:reportId" element={<ReportEditor />} />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  sessionStorage.clear();
  api.scope = 'A';
  vi.clearAllMocks();
  api.get.mockImplementation(async url => {
    if (url === '/reports/roots/2')
      return {
        data: {
          dashboardId: 2,
          revision: 'a'.repeat(64),
          organizationId: null,
          title: 'Sales',
          blocks: [
            { id: 'kpi', kind: 'BOARD_NUMERIC', title: '매출' },
            { id: 'chart', kind: 'CHART_COLUMN', title: '채널' },
          ],
        },
      };
    if (url.includes('/outcome/')) return { data: { status: 'missing' } };
    return { data: report() };
  });
  api.post.mockImplementation(async url => ({
    data: url.endsWith('/preview')
      ? { snapshot: snapshot(), previewDigest: 'f'.repeat(64) }
      : { report: report(), replayed: false },
  }));
});
afterEach(cleanup);
it('requires an explicit preview, then saves plaintext and references without client results', async () => {
  show();
  await waitFor(() => expect((screen.getByLabelText('보고서 제목') as HTMLInputElement).value).toBe('Sales 보고서'));
  expect(screen.getByRole('button', { name: '비공개 저장', exact: true }).hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('본문'), { target: { value: '수동 본문\n<script>text</script>' } });
  fireEvent.click(screen.getByRole('button', { name: '현재 데이터 명시 미리보기' }));
  await screen.findByText(/16537.01/);
  fireEvent.click(screen.getByRole('button', { name: '비공개 저장', exact: true }));
  await waitFor(() => expect(api.post.mock.calls.some(call => call[0].endsWith('/save'))).toBe(true));
  const command = api.post.mock.calls.find(call => call[0].endsWith('/save'))[1];
  expect(command.body).toBe('수동 본문\n<script>text</script>');
  expect(command.data).toEqual(ticket().command.data);
  expect(JSON.stringify(command)).not.toContain('datas');
  expect(JSON.stringify(command)).not.toContain('16537.01');
  expect(document.querySelector('script')).toBeNull();
});
it('reopens stored data without loading Studio or source options and text-only save retains its revision', async () => {
  show('/reports/' + id);
  await screen.findByText(/16537.01/);
  expect(api.get.mock.calls.map(call => call[0])).toEqual(['/reports/' + id]);
  fireEvent.change(screen.getByLabelText('본문'), { target: { value: '본문 수정' } });
  fireEvent.keyDown(screen.getByLabelText('본문'), { key: 'Enter', ctrlKey: true });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][1].data).toEqual({ mode: 'retain', fromRevision: 'e'.repeat(64) });
});
it('reload recovers the bounded command and looks up outcome without a POST; retry uses the exact UUID', async () => {
  storeReportPending(key, ticket());
  show();
  await screen.findByRole('region', { name: '미확정 저장 요청' });
  await waitFor(() => expect(api.get.mock.calls.some(call => call[0].includes('/outcome/'))).toBe(true));
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('<script>본문 보존</script>');
  fireEvent.click(screen.getByRole('button', { name: '동일 요청 다시 보내기' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/reports/' + id + '/save', ticket().command, expect.anything()),
  );
});
it('409 preserves draft and pending identity, and only an explicit release enables editing', async () => {
  const pending = ticket();
  storeReportPending(key, pending);
  api.post.mockRejectedValue({ response: { status: 409, data: { message: '기준 변경' } } });
  show();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '동일 요청 다시 보내기' }).hasAttribute('disabled')).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '동일 요청 다시 보내기' }));
  await screen.findByText(/보고서 또는 원본의 기준이 변경됐습니다/);
  expect(readReportPending(key)?.command).toEqual(pending.command);
  expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(pending.command.body);
  fireEvent.click(screen.getByRole('button', { name: '보관 해제하고 초안 편집' }));
  expect(screen.getByLabelText('본문').hasAttribute('disabled')).toBe(false);
  expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(pending.command.body);
  expect(readReportPending(key)).toBeNull();
});
it('preserves artifact return context in list and Studio navigation', async () => {
  const context = { version: 1, query: '매출', kind: 'analysis', sort: 'title', display: 'grid', view: 'active' };
  show('/reports/new?dashboardId=2&artifactReturn=' + encodeURIComponent(JSON.stringify(context)));
  await waitFor(() => expect((screen.getByLabelText('보고서 제목') as HTMLInputElement).value).toBe('Sales 보고서'));
  expect(screen.getByRole('link', { name: 'Artifact 허브' }).getAttribute('href')).toContain('artifactQuery=');
  expect(screen.getByRole('link', { name: '비공개 보고서 목록' }).getAttribute('href')).toContain('artifactReturn=');
});
it('rejects tampered persisted commands and enforces TTL and byte bounds', () => {
  const pending = ticket();
  sessionStorage.setItem(key, JSON.stringify({ ...pending, command: { ...pending.command, datas: [] } }));
  expect(readReportPending(key)).toBeNull();
  expect(storeReportPending(key, { ...pending, updatedAt: Date.now() - 86400001 })).toBe(false);
  expect(storeReportPending(key, { ...pending, command: { ...pending.command, body: '😀'.repeat(16385) } })).toBe(false);
  expect(storeReportPending(key, pending)).toBe(true);
  expect(readReportPending(key)?.command).toEqual(pending.command);
});
it('does not construct a storage key or expose delayed report data after an account switch', async () => {
  let resolveA: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveA = resolve;
      }),
  );
  api.get.mockRejectedValue(new Error('B cannot read A'));
  show('/reports/' + id);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  await act(async () => {
    api.scope = 'B';
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await act(async () => resolveA({ data: report() }));
  expect(screen.queryByDisplayValue('저장 보고서')).toBeNull();
  expect(screen.queryByText(/16537.01/)).toBeNull();
  expect(api.key).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
it('clears visible report/list data on account switch and ignores the old list response', async () => {
  let resolveA: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveA = resolve;
      }),
  );
  api.get.mockResolvedValue({ data: [] });
  render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  );
  await act(async () => {
    api.scope = 'B';
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await act(async () =>
    resolveA({ data: [{ id, title: 'A private report', revision: 'e'.repeat(64), updatedAt: '2026-10-29T00:00:00Z' }] }),
  );
  expect(screen.queryByText('A private report')).toBeNull();
  await screen.findByText(/아직 저장된 보고서/);
});
it('keeps the exact pending command when outcome exists but latest-head GET fails', async () => {
  const storedKey = 'actor-org-epoch:private-report:none:' + id;
  const pending = ticket();
  storeReportPending(storedKey, pending);
  let reads = 0;
  api.get.mockImplementation(async url => {
    if (url.includes('/outcome/')) return { data: { status: 'committed', report: report() } };
    reads += 1;
    if (reads === 1) return { data: report() };
    throw new Error('latest GET unavailable');
  });
  show('/reports/' + id);
  await waitFor(() => expect(screen.getByRole('button', { name: '저장 결과 열기' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '저장 결과 열기' }));
  await screen.findByRole('alert');
  expect(readReportPending(storedKey)?.command).toEqual(pending.command);
  expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(pending.command.body);
});
it('reconciles an historical replay receipt with the latest head on the same route', async () => {
  const storedKey = 'actor-org-epoch:private-report:none:' + id;
  storeReportPending(storedKey, ticket());
  const latest = { ...report(), version: 3, body: '최신 r3 본문', revision: '3'.repeat(64) };
  api.get.mockImplementation(async url => ({ data: url.includes('/outcome/') ? { status: 'missing' } : latest }));
  api.post.mockResolvedValue({ data: { report: { ...report(), version: 2, body: '과거 r2 본문' }, replayed: true } });
  show('/reports/' + id);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '동일 요청 다시 보내기' }).hasAttribute('disabled')).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '동일 요청 다시 보내기' }));
  await waitFor(() => expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('최신 r3 본문'));
  expect(screen.getByRole('status').textContent).toContain('r2');
  expect(screen.getByRole('status').textContent).toContain('r3');
  expect(readReportPending(storedKey)).toBeNull();
});
it('uses a fresh report UUID when the new-report root changes without leaving the route', async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(async url =>
    url === '/reports/roots/3'
      ? {
          data: {
            dashboardId: 3,
            revision: 'a'.repeat(64),
            organizationId: null,
            title: 'Next root',
            blocks: [
              { id: 'kpi', kind: 'BOARD_NUMERIC', title: '매출' },
              { id: 'chart', kind: 'CHART_COLUMN', title: '채널' },
            ],
          },
        }
      : originalGet(url),
  );
  render(
    <MemoryRouter initialEntries={['/reports/new?dashboardId=2']}>
      <Link to="/reports/new?dashboardId=3">다른 원본</Link>
      <Routes>
        <Route path="/reports/new" element={<ReportEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect((screen.getByLabelText('보고서 제목') as HTMLInputElement).value).toBe('Sales 보고서'));
  fireEvent.click(screen.getByRole('button', { name: '현재 데이터 명시 미리보기' }));
  await screen.findByText(/16537.01/);
  const firstId = api.post.mock.calls[0][0];
  fireEvent.click(screen.getByRole('link', { name: '다른 원본' }));
  await waitFor(() => expect((screen.getByLabelText('보고서 제목') as HTMLInputElement).value).toBe('Next root 보고서'));
  fireEvent.click(screen.getByRole('button', { name: '현재 데이터 명시 미리보기' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][0]).not.toBe(firstId);
});

it.each([403, 404])('hides the existing workflow after initial %s and retries only reads', async status => {
  const storedKey = 'actor-org-epoch:private-report:none:' + id;
  const pending = ticket();
  storeReportPending(storedKey, pending);
  api.get.mockRejectedValueOnce({ response: { status, data: { message: 'Forbidden' } } });
  show('/reports/' + id);
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain(status === 403 ? '접근할 수 없습니다' : '찾을 수 없습니다');
  expect(screen.queryByLabelText('보고서 제목')).toBeNull();
  expect(screen.queryByLabelText('본문')).toBeNull();
  expect(screen.queryByText('비공개 보고서 작성')).toBeNull();
  expect(screen.queryByText('작성 중')).toBeNull();
  expect(screen.queryByText(/16537.01/)).toBeNull();
  expect(screen.queryByRole('button', { name: '현재 데이터 명시 미리보기' })).toBeNull();
  expect(screen.queryByRole('button', { name: '비공개 저장' })).toBeNull();
  expect(api.key).not.toHaveBeenCalled();
  expect(readReportPending(storedKey)).toEqual(pending);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
  await screen.findByRole('region', { name: '미확정 저장 요청' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '동일 요청 다시 보내기' }).hasAttribute('disabled')).toBe(false),
  );
  expect(screen.getByDisplayValue(pending.command.body)).toBeTruthy();
  expect(api.get.mock.calls.map(call => call[0])).toEqual([
    '/reports/' + id,
    '/reports/' + id,
    '/reports/' + id + '/outcome/' + requestId,
  ]);
  expect(readReportPending(storedKey)).toEqual(pending);
  expect(api.post).not.toHaveBeenCalled();
});
it.each([403, 404])('hides creation until an authorized root loads after %s', async status => {
  api.get.mockRejectedValueOnce({ response: { status } });
  show();
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('본문')).toBeNull();
  expect(screen.queryByText('작성 중')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
  await screen.findByDisplayValue('Sales 보고서');
  expect(api.get.mock.calls.map(call => call[0])).toEqual(['/reports/roots/2', '/reports/roots/2']);
  expect(api.post).not.toHaveBeenCalled();
});
it('hides creation while the initial read is pending', async () => {
  let finish: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  show('/reports/' + id);
  expect(screen.queryByLabelText('본문')).toBeNull();
  expect(screen.getByRole('button', { name: '다시 불러오기' }).hasAttribute('disabled')).toBe(true);
  await act(async () => finish({ data: report() }));
  await screen.findByDisplayValue('저장 본문');
});
it.each([409, 'network'])('keeps loaded draft and exact save ticket after %s', async failure => {
  const storedKey = 'actor-org-epoch:private-report:none:' + id;
  api.post.mockRejectedValue(failure === 409 ? { response: { status: 409 } } : new Error('offline'));
  show('/reports/' + id);
  await screen.findByDisplayValue('저장 본문');
  fireEvent.change(screen.getByLabelText('보고서 제목'), { target: { value: '수정 제목' } });
  fireEvent.change(screen.getByLabelText('본문'), { target: { value: '보존할 수정 본문' } });
  fireEvent.click(screen.getByRole('button', { name: '비공개 저장', exact: true }));
  await screen.findByRole('alert');
  expect(screen.getByDisplayValue('수정 제목')).toBeTruthy();
  expect(screen.getByDisplayValue('보존할 수정 본문')).toBeTruthy();
  expect(screen.getByText(/16537.01/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '다시 불러오기' })).toBeNull();
  const command = api.post.mock.calls[0][1];
  expect(readReportPending(storedKey)?.command).toEqual(command);
  expect(command.data).toEqual({ mode: 'retain', fromRevision: report().revision });
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '동일 요청 다시 보내기' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual(command);
  expect(readReportPending(storedKey)?.command).toEqual(command);
});
