import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Publication, { expiryInstant } from './index';
import Published from './Published';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), id: '12', uuid: 'public-fixture', search: '' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: api.search }),
  useParams: () => ({ dashboardId: api.id, publicationUuid: api.uuid }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock('@/components/analysis/AnalysisUi', () => ({
  AnalysisUiProvider: ({ children }: any) => <>{children}</>,
  analysisFieldSx: {},
  analysisPanelSx: {},
}));
vi.mock('@mui/material', () => ({
  Box: ({ children }: any) => <div>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Typography: ({ children, role }: any) => <p role={role}>{children}</p>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  TextField: ({ label, value, onChange, disabled }: any) => (
    <label>
      {label}
      <input value={value} onChange={onChange} disabled={disabled} />
    </label>
  ),
}));
vi.mock('./SnapshotView', () => ({ default: ({ snapshot }: any) => <div>결과: {snapshot.title}</div> }));
const initial = () => ({ dashboardId: Number(api.id), revision: 'a'.repeat(64), version: 0, publication: null });
const preview = () => ({
  dashboardId: Number(api.id),
  revision: 'a'.repeat(64),
  ticket: 'ticket-one',
  snapshot: { schemaVersion: 1, title: '요청 수', widgets: [] },
});
const wrap = (data: any) => ({ data: { status: 'SUCCESS', data } });
const published = () => ({
  ...initial(),
  version: 1,
  publication: {
    uuid: 'public-fixture',
    version: 1,
    active: true,
    dashboardRevision: 'a'.repeat(64),
    publishedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
});
beforeEach(() => {
  api.search = '';
  api.id = '12';
  api.uuid = 'public-fixture';
  api.get.mockReset().mockResolvedValue(wrap(initial()));
  api.post.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const open = async () => {
  render(<Publication />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
};
const makePreview = async () => {
  api.post.mockResolvedValueOnce(wrap(preview()));
  fireEvent.click(screen.getByRole('button', { name: '게시 결과 미리보기' }));
  await screen.findByText('결과: 요청 수');
};
it('UC-019 prepares the saved revision, including reload, without an automatic public write', async () => {
  api.search = `?savedRevision=${initial().revision}`;
  api.post.mockResolvedValueOnce(wrap(preview()));
  const view = render(<Publication />);
  await screen.findByText('결과: 요청 수');
  expect(screen.getByText(/저장 완료 · 링크 공개·갱신은 게시 버튼/)).not.toBeNull();
  expect(api.post.mock.calls[0][1]).toEqual({ expectedRevision: initial().revision });
  view.unmount();
  api.post.mockResolvedValueOnce(wrap(preview()));
  render(<Publication />);
  await screen.findByText('결과: 요청 수');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls.every(call => call[0] === '/bi/dashboards/12/publication/preview')).toBe(true);
  api.post.mockResolvedValueOnce(wrap(published()));
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText('게시 버전 1을 저장했습니다.');
  expect(api.post.mock.calls[2][0]).toBe('/bi/dashboards/12/publication');
});
it.each([
  `?savedRevision=${'b'.repeat(64)}`,
  '?savedRevision=invalid',
  `?savedRevision=${'a'.repeat(64)}&savedRevision=${'a'.repeat(64)}`,
])('UC-019 blocks malformed or mismatched saved revision %s', async search => {
  api.search = search;
  render(<Publication />);
  await screen.findByText(/질문에서 저장한 버전과 현재 저장본이 다릅니다/);
  expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '링크 게시' }) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '게시 상태 확인' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '게시 상태 확인' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await screen.findByText(/질문에서 저장한 버전과 현재 저장본이 다릅니다/);
  expect(api.post).not.toHaveBeenCalled();
});
it('UC-019 failed automatic preview preserves save and permits read-only retry', async () => {
  api.search = `?savedRevision=${initial().revision}`;
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  render(<Publication />);
  await screen.findByText(/저장한 분석은 유지됩니다. 게시 준비에 실패/);
  api.post.mockResolvedValueOnce(wrap(preview()));
  fireEvent.click(screen.getByRole('button', { name: '게시 결과 미리보기' }));
  await screen.findByText('결과: 요청 수');
  expect(api.post.mock.calls.every(call => call[0].endsWith('/publication/preview'))).toBe(true);
});
it('UC-019 distinguishes an active publication from a stopped previous publication on handoff', async () => {
  api.search = `?savedRevision=${initial().revision}`;
  api.get.mockResolvedValueOnce(wrap(published()));
  api.post.mockResolvedValueOnce(wrap(preview()));
  const view = render(<Publication />);
  await screen.findByText('결과: 요청 수');
  expect(screen.queryByText(/저장 완료 · 게시 전/)).toBeNull();
  expect(screen.getByRole('button', { name: '이 결과로 재게시' })).not.toBeNull();
  view.unmount();
  api.get.mockResolvedValueOnce(wrap({ ...published(), publication: { ...published().publication, active: false } }));
  api.post.mockResolvedValueOnce(wrap(preview()));
  render(<Publication />);
  await screen.findByText('결과: 요청 수');
  expect(screen.getByRole('button', { name: '링크 게시' })).not.toBeNull();
  expect(screen.queryByText(/재게시 전까지 기존 게시 결과가 유지/)).toBeNull();
});
it('UC-019 ignores a late preview from a previous handoff route', async () => {
  api.search = `?savedRevision=${initial().revision}`;
  let resolve: any;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = render(<Publication />);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  api.id = '13';
  api.search = '';
  api.get.mockResolvedValueOnce(wrap(initial()));
  view.rerender(<Publication />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  await act(async () => resolve(wrap({ ...preview(), dashboardId: 12 })));
  expect(screen.queryByText('결과: 요청 수')).toBeNull();
  expect((screen.getByRole('button', { name: '링크 게시' }) as HTMLButtonElement).disabled).toBe(true);
});
it('UC-019 rejects a preview for another saved revision', async () => {
  api.search = `?savedRevision=${initial().revision}`;
  api.post.mockResolvedValueOnce(wrap({ ...preview(), revision: 'b'.repeat(64) }));
  render(<Publication />);
  await screen.findByText(/게시 준비에 실패/);
  expect(screen.queryByText('결과: 요청 수')).toBeNull();
  expect((screen.getByRole('button', { name: '링크 게시' }) as HTMLButtonElement).disabled).toBe(true);
});
it('requires preview then explicitly publishes only server ticket/scope, not snapshot values', async () => {
  await open();
  expect((screen.getByRole('button', { name: '링크 게시' }) as HTMLButtonElement).disabled).toBe(true);
  await makePreview();
  api.post.mockResolvedValueOnce(wrap(published()));
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText('게시 버전 1을 저장했습니다.');
  expect(api.post.mock.calls[1][1]).toMatchObject({
    ticket: 'ticket-one',
    expectedVersion: 0,
    expectedRevision: 'a'.repeat(64),
    visibility: 'link',
  });
  expect(api.post.mock.calls[1][1]).not.toHaveProperty('snapshot');
  expect((screen.getByLabelText('게시 링크') as HTMLInputElement).value).toBe(
    `${window.location.origin}/published/public-fixture`,
  );
  expect(screen.queryByText('결과: 요청 수')).toBeNull();
});
it('lost response locks new publishes and retries the exact same request id and ticket', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce(new Error('Network Error'));
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText(/게시 결과가 확실하지/);
  const original = api.post.mock.calls[1][1];
  expect((screen.getByRole('button', { name: '링크 게시' }) as HTMLButtonElement).disabled).toBe(true);
  api.post.mockResolvedValueOnce(wrap(published()));
  fireEvent.click(screen.getByRole('button', { name: '같은 게시 요청 다시 확인' }));
  await screen.findByText('게시 버전 1을 저장했습니다.');
  expect(api.post.mock.calls[2][1]).toEqual(original);
});
it('409 preserves saved analysis and requires status reload plus new preview', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText(/저장 또는 게시 버전이 변경/);
  expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(wrap(published()));
  fireEvent.click(screen.getByRole('button', { name: '게시 상태 확인' }));
  await screen.findByText(/게시 상태를 확인했습니다/);
  expect((screen.getByRole('button', { name: '이 결과로 재게시' }) as HTMLButtonElement).disabled).toBe(true);
});
it('revokes with publication version and clears old preview', async () => {
  api.get.mockResolvedValueOnce(wrap(published()));
  await open();
  await makePreview();
  api.post.mockResolvedValueOnce(
    wrap({ ...published(), version: 2, publication: { ...published().publication, version: 2, active: false } }),
  );
  fireEvent.click(screen.getByRole('button', { name: '게시 중지' }));
  await screen.findByText(/게시를 중지했습니다/);
  expect(api.post.mock.calls[1][0]).toBe('/bi/dashboards/12/publication/revoke');
  expect(api.post.mock.calls[1][1]).toEqual({ expectedVersion: 1 });
  expect(screen.queryByText('결과: 요청 수')).toBeNull();
});
it('ignores old route status response and does not permit publishing its preview', async () => {
  let resolve: any;
  api.get.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = render(<Publication />);
  api.get.mockResolvedValueOnce(wrap({ ...initial(), dashboardId: 13 }));
  api.id = '13';
  view.rerender(<Publication />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  await act(async () => {
    resolve(wrap({ ...published(), dashboardId: 12 }));
  });
  expect(screen.queryByLabelText('게시 링크')).toBeNull();
});
it('rejects invalid calendar dates, past dates and over-30day expiries', () => {
  expect(expiryInstant('2026-02-30')).toBeNull();
  expect(expiryInstant('2000-01-01')).toBeNull();
  expect(expiryInstant('2099-01-01')).toBeNull();
  expect(expiryInstant(new Date(Date.now() + 86400000).toISOString().slice(0, 10))).toMatch(/T23:59:59/);
});
it('public page fetches no auth and never calls owner or source endpoints', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'SUCCESS',
      data: { ...published().publication, dataMode: 'snapshot', visibility: 'link', snapshot: preview().snapshot },
    }),
  });
  vi.stubGlobal('fetch', fetcher);
  render(<Published />);
  await screen.findByText('결과: 요청 수');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain('/publications/public-fixture');
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('public inactive or expired link shows failure without rendering data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  render(<Published />);
  await screen.findByText('게시가 중지되었거나 만료된 링크입니다.');
  expect(screen.queryByText('결과: 요청 수')).toBeNull();
});

it('expired ticket400 keeps the expiry input and new preview usable without uncertainty', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce({ response: { status: 400 }, message: '게시 미리보기가 만료되었습니다.' });
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText('게시 미리보기가 만료되었습니다.');
  expect((screen.getByRole('button', { name: '게시 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByLabelText('만료일 (UTC)') as HTMLInputElement).disabled).toBe(false);
});
it('an expired publication does not advertise a dead link', async () => {
  api.get.mockResolvedValueOnce(
    wrap({ ...published(), publication: { ...published().publication, expiresAt: '2000-01-01T00:00:00.000Z' } }),
  );
  await open();
  expect(screen.queryByLabelText('게시 링크')).toBeNull();
  expect(screen.queryByRole('button', { name: '게시된 결과 열기' })).toBeNull();
});
it('request id failure before dispatch is not reported as an uncertain write', async () => {
  await open();
  await makePreview();
  const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    throw new Error('secure context required');
  });
  fireEvent.click(screen.getByRole('button', { name: '링크 게시' }));
  await screen.findByText(/게시 요청을 만들지 못했습니다/);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/게시 결과가 확실하지/)).toBeNull();
  spy.mockRestore();
});
