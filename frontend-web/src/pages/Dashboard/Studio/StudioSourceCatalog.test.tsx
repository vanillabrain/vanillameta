import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { post } from '@/helpers/apiHelper';
import StudioSourceCatalog from './StudioSourceCatalog';
import StudioSourcePicker from './StudioSourcePicker';
import { SourceProfile } from './studioCreation';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
afterEach(cleanup);
const profile: SourceProfile = {
  sourceId: 3,
  name: 'orders.csv',
  rowCount: '10',
  dataVersion: 'rev1',
  supported: true,
  columns: [{ name: 'revenue', type: 'DOUBLE' }],
};
const catalog = () => ({
  sourceId: 3,
  sourceRevision: 'rev1',
  version: 2,
  label: '결제 내역',
  description: '결제 완료 기준',
  schemaChanged: false,
  columns: [{ column: 'revenue', type: 'DOUBLE', label: '결제액', description: '취소 전 결제 금액', unit: '원' }],
});
const response = (data: any) => ({
  data: { status: 'SUCCESS', data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const open = () => fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명 확인' }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(catalog()));
});
it('only reads on opening and shows meaning alongside original schema', async () => {
  render(<StudioSourceCatalog profile={profile} />);
  expect(post).not.toHaveBeenCalled();
  open();
  await screen.findByText('결제 내역');
  for (const value of ['결제 완료 기준', '결제액', '취소 전 결제 금액', '원', 'revenue', 'DOUBLE', '업무 설명 저장 버전 2'])
    expect(screen.getByText(value)).toBeTruthy();
  expect(post).toHaveBeenCalledWith('/bi/source-catalog/read', { sourceId: 3 });
  expect(screen.queryByRole('textbox')).toBeNull();
});
it('does not present unregistered defaults as saved meaning', async () => {
  vi.mocked(post).mockResolvedValue(response({ ...catalog(), version: 0 }));
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText('아직 저장된 업무 설명이 없습니다.');
  expect(screen.queryByText('결제 내역')).toBeNull();
});
it.each([
  { sourceId: 9 },
  { sourceRevision: 'rev2' },
  { schemaChanged: true },
  { columns: [{ ...catalog().columns[0], type: 'VARCHAR' }] },
  { columns: [] },
])('hides mismatched metadata %j', async patch => {
  vi.mocked(post).mockResolvedValue(response({ ...catalog(), ...patch }));
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/현재 데이터와 업무 설명의 기준이 다릅니다/);
  expect(screen.queryByText('결제 내역')).toBeNull();
});
it('rejects malformed metadata', async () => {
  vi.mocked(post).mockResolvedValue(response({ ...catalog(), label: { unexpected: true } }));
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/업무 설명을 확인하지 못했습니다/);
});
it.each([403, 503])('clears old metadata on reload failure %s and retries', async status => {
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText('결제 내역');
  vi.mocked(post).mockRejectedValueOnce({ response: { status } });
  fireEvent.click(screen.getByRole('button', { name: '업무 설명 다시 조회' }));
  await screen.findByText(/업무 설명을 확인하지 못했습니다/);
  expect(screen.queryByText('결제 내역')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '업무 설명 다시 조회' }));
  await screen.findByText('결제 내역');
  expect(vi.mocked(post).mock.calls.every(([url]) => url === '/bi/source-catalog/read')).toBe(true);
});
it.each(['source', 'revision', 'schema'])('ignores late response after changing %s', async kind => {
  let finish: (value: any) => void;
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<StudioSourceCatalog profile={profile} />);
  open();
  const next =
    kind === 'source'
      ? { ...profile, sourceId: 4 }
      : kind === 'revision'
      ? { ...profile, dataVersion: 'rev2' }
      : { ...profile, columns: [{ name: 'revenue', type: 'DECIMAL' }] };
  view.rerender(<StudioSourceCatalog profile={next} />);
  finish(response(catalog()));
  await waitFor(() => expect(screen.queryByText('결제 내역')).toBeNull());
  expect(screen.getByRole('button', { name: '데이터 업무 설명 확인' }).getAttribute('aria-expanded')).toBe('false');
});
it('reopens with a fresh read', async () => {
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText('결제 내역');
  open();
  open();
  await screen.findByText('결제 내역');
  expect(post).toHaveBeenCalledTimes(2);
});
it('does not read without a profile version', () => {
  render(<StudioSourceCatalog profile={{ ...profile, dataVersion: undefined }} />);
  open();
  expect(screen.getByText(/소스 새로 확인 후/)).toBeTruthy();
  expect(post).not.toHaveBeenCalled();
});
it('connects to the existing source picker without changing selection or invoking callbacks', async () => {
  const callbacks = { onSource: vi.fn(), onFile: vi.fn(), onSample: vi.fn(), onRefresh: vi.fn() };
  render(
    <StudioSourcePicker
      sources={[{ id: 3, name: 'orders.csv', engine: 'duckdb' }]}
      sourceId={3}
      profile={profile}
      busy={false}
      {...callbacks}
    />,
  );
  open();
  await screen.findByText('결제 내역');
  expect((screen.getByLabelText('저장된 데이터') as HTMLSelectElement).value).toBe('3');
  Object.values(callbacks).forEach(callback => expect(callback).not.toHaveBeenCalled());
});

it('does not refetch when the parent renders an equivalent profile snapshot', async () => {
  const view = render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText('결제 내역');
  view.rerender(<StudioSourceCatalog profile={{ ...profile, columns: [...profile.columns] }} />);
  expect(screen.getByText('결제 내역')).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
});

it('shows saved business meaning separately from the physical type without new requests', async () => {
  vi.mocked(post).mockResolvedValue(
    response({
      ...catalog(),
      columns: [{ ...catalog().columns[0], businessType: 'number', dateFormat: '', classification: '매출' }],
    }),
  );
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText('업무 유형: 수치');
  expect(screen.getByText('업무 분류: 매출')).toBeTruthy();
  expect(screen.getByText('DOUBLE')).toBeTruthy();
  expect(vi.mocked(post).mock.calls).toHaveLength(1);
  expect(screen.queryByRole('textbox')).toBeNull();
});
it('hides malformed saved business fields instead of displaying an accepted definition', async () => {
  vi.mocked(post).mockResolvedValue(
    response({ ...catalog(), columns: [{ ...catalog().columns[0], businessType: 'date', dateFormat: 'anything' }] }),
  );
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/업무 설명을 확인하지 못했습니다/);
  expect(screen.queryByText('결제액')).toBeNull();
});

it('preserves a frozen old-organization classification reference and name without current-registry lookup', async () => {
  vi.mocked(post).mockResolvedValueOnce(
    response({
      ...catalog(),
      columns: [
        {
          ...catalog().columns[0],
          classification: '과거 분류 이름',
          classificationRef: { organizationId: 99, id: 4, version: 2 },
        },
      ],
    }),
  );
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/업무 분류: 과거 분류 이름/);
  expect(screen.getByText(/조직 99 · 분류 4 · 버전 2/)).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
});
it('accepts stored null as detached metadata and rejects malformed linked refs', async () => {
  vi.mocked(post).mockResolvedValueOnce(
    response({ ...catalog(), columns: [{ ...catalog().columns[0], classification: '자유 분류', classificationRef: null }] }),
  );
  const view = render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/업무 분류: 자유 분류/);
  view.unmount();
  vi.mocked(post).mockResolvedValueOnce(
    response({
      ...catalog(),
      columns: [{ ...catalog().columns[0], classificationRef: { organizationId: 99, id: 4, version: 0 } }],
    }),
  );
  render(<StudioSourceCatalog profile={profile} />);
  open();
  await screen.findByText(/업무 설명을 확인하지 못했습니다/);
});
