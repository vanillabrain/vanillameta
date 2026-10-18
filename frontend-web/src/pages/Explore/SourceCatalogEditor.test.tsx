import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SourceCatalogEditor from './SourceCatalogEditor';
import { post, get } from '@/helpers/apiHelper';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn(), get: vi.fn() }));
afterEach(cleanup);
const data = () => ({
  sourceId: 3,
  version: 0,
  sourceRevision: 'v1',
  label: '주문',
  description: '',
  schemaChanged: false,
  columns: [{ column: 'amount', type: 'DOUBLE', label: '금액', description: '', unit: '원' }],
});
const response = value => ({
  data: { status: 'SUCCESS', data: value },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
  await screen.findByLabelText('소스 표시명');
};
const draft = (label: string) => ({
  sourceId: 3,
  sourceRevision: 'v1',
  version: 0,
  label,
  description: '',
  columns: [{ column: 'amount', label: '금액', description: '', unit: '원' }],
});
const review = async (label: string) => {
  vi.mocked(post).mockResolvedValueOnce(
    response({ draft: draft(label), changes: [{ column: null, field: 'label', before: '주문', after: label }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText('저장 전 변경 1개');
  fireEvent.click(screen.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' }));
};
describe('UC050 business metadata editor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(post).mockResolvedValue(response(data()));
  });
  it('starts collapsed without a request, explicitly reads and saves, then reloads the saved version', async () => {
    const view = render(<SourceCatalogEditor sourceId={3} />);
    expect(post).not.toHaveBeenCalled();
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '결제 내역' } });
    await review('결제 내역');
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), label: '결제 내역', version: 1 }));
    fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
    await screen.findByText('업무 설명을 저장했습니다.');
    expect(post).toHaveBeenLastCalledWith(
      '/bi/source-catalog/save',
      expect.objectContaining({
        label: '결제 내역',
        version: 0,
        sourceRevision: 'v1',
        columns: [{ column: 'amount', label: '금액', description: '', unit: '원' }],
      }),
    );
    view.unmount();
    vi.mocked(post).mockResolvedValue(response({ ...data(), label: '결제 내역', version: 1 }));
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('결제 내역');
  });
  it('preserves input on failed save and only replaces it after explicit latest-load confirmation', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '내 초안' } });
    await review('내 초안');
    vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
    await screen.findByText(/다른 창 또는 데이터가 변경/);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('내 초안');
    fireEvent.click(screen.getByRole('button', { name: '최신 설명 다시 읽기' }));
    expect(post).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: '내 입력을 버리고 최신 설명 읽기' }));
    await waitFor(() => expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('주문'));
  });
  it('retries failed reads and blocks structural changes', async () => {
    vi.mocked(post).mockRejectedValueOnce(new Error('offline'));
    render(<SourceCatalogEditor sourceId={3} />);
    fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
    await screen.findByText('업무 설명을 불러오지 못했습니다. 다시 시도해 주세요.');
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), schemaChanged: true }));
    fireEvent.click(screen.getByRole('button', { name: '업무 설명 다시 읽기' }));
    await screen.findByText(/열 구조가 변경/);
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('keeps a draft when collapsed and clears it when switching sources', async () => {
    const view = render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '초안' } });
    fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
    await open();
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('초안');
    view.rerender(<SourceCatalogEditor sourceId={4} />);
    expect(screen.queryByLabelText('소스 표시명')).toBeNull();
  });
  it('ignores a delayed read after the source identity changes', async () => {
    let resolveRead: (value: any) => void;
    vi.mocked(post).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRead = resolve;
        }),
    );
    const view = render(<SourceCatalogEditor sourceId={3} />);
    fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
    view.rerender(<SourceCatalogEditor sourceId={4} />);
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), sourceId: 4, label: '다른 소스' }));
    await open();
    resolveRead(response(data()));
    await waitFor(() => expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('다른 소스'));
    expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/read', { sourceId: 4 });
  });
  it('explains unreadable server history instead of presenting an editable empty catalog', async () => {
    vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
    render(<SourceCatalogEditor sourceId={3} />);
    fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
    await screen.findByText('저장 이력을 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.');
    expect(screen.queryByRole('button', { name: '확인한 변경 저장' })).toBeNull();
  });
  it('preserves unsaved input while reading history and comparing saved versions', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '미저장 초안' } });
    vi.mocked(post).mockResolvedValueOnce(
      response({
        sourceId: 3,
        entries: [2, 1].map(version => ({ version, label: '저장본', createdAt: '2026-10-18T00:00:00Z', unreadable: false })),
        nextBeforeVersion: null,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '저장 이력·버전 비교' }));
    await screen.findByLabelText('이전 설명 버전');
    vi.mocked(post).mockResolvedValueOnce(
      response({ sourceId: 3, fromVersion: 1, toVersion: 2, changes: [], schemaChanged: false, dataChanged: false }),
    );
    fireEvent.click(screen.getByRole('button', { name: '선택한 버전 비교' }));
    await screen.findByText('두 버전의 업무 설명은 같습니다.');
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('미저장 초안');
    expect(vi.mocked(post).mock.calls.some(([url]) => url === '/bi/source-catalog/save')).toBe(false);
  });
  it('requires preview and confirmation, saves the reviewed normalized payload and invalidates review on edits', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '  결제 내역  ' } });
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(post).mockResolvedValueOnce(
      response({
        draft: draft('결제 내역'),
        changes: [{ column: null, field: 'label', before: '주문', after: '결제 내역' }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
    await screen.findByText('저장 전 변경 1개');
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' }));
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '새 입력' } });
    expect(screen.queryByText('저장 전 변경 1개')).toBeNull();
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    await review('새 입력');
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), label: '새 입력', version: 1 }));
    fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
    await screen.findByText('업무 설명을 저장했습니다.');
    expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/save', draft('새 입력'));
  });
  it('preserves input after preview validation failure and never saves zero normalized changes', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '' } });
    vi.mocked(post).mockRejectedValueOnce({ response: { status: 400 } });
    fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
    await screen.findByText(/중복 표시명과 빈 이름/);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: ' 주문 ' } });
    vi.mocked(post).mockResolvedValueOnce(response({ draft: draft('주문'), changes: [] }));
    fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
    await screen.findByText('저장할 업무 설명 변경이 없습니다.');
    expect(screen.queryByText(/미저장 변경/)).toBeNull();
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe(' 주문 ');
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    expect(vi.mocked(post).mock.calls.some(([url]) => url === '/bi/source-catalog/save')).toBe(false);
  });
  it('sends the exact normalized preview draft after confirmation', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '  결제 내역  ' } });
    await review('결제 내역');
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), label: '결제 내역', version: 1 }));
    fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
    await screen.findByText('업무 설명을 저장했습니다.');
    expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/save', draft('결제 내역'));
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('결제 내역');
  });
  it.each([409, 503])('keeps draft and prevents saving after preview failure %s', async status => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '보존할 입력' } });
    vi.mocked(post).mockRejectedValueOnce({ response: { status } });
    fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
    await screen.findByText(status === 409 ? /다른 창 또는 데이터가 변경/ : /미리보기를 다시 시도/);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('보존할 입력');
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    expect(vi.mocked(post).mock.calls.some(([url]) => url === '/bi/source-catalog/save')).toBe(false);
  });
  it('clears consent after an uncertain save and preserves the draft for explicit latest-read verification', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '보존할 입력' } });
    await review('보존할 입력');
    vi.mocked(post).mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
    await screen.findByText(/최신 설명을 읽어 반영 여부/);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('보존할 입력');
    expect(screen.queryByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' })).toBeNull();
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '최신 설명 다시 읽기' }));
    expect(screen.getByText('다시 읽으면 현재 입력을 최신 저장 내용으로 바꿉니다.')).toBeTruthy();
    expect(vi.mocked(post).mock.calls.filter(([url]) => url === '/bi/source-catalog/save')).toHaveLength(1);
  });
  it('rejects a preview whose displayed after value disagrees with the draft to save', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '결제 내역' } });
    vi.mocked(post).mockResolvedValueOnce(
      response({
        draft: draft('결제 내역'),
        changes: [{ column: null, field: 'label', before: '주문', after: '다른 내용' }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
    await screen.findByText(/미리보기를 다시 시도/);
    expect(screen.queryByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' })).toBeNull();
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('결제 내역');
  });
  it('keeps the draft, preview and confirmation while inspecting source usage', async () => {
    render(<SourceCatalogEditor sourceId={3} />);
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '보존할 초안' } });
    await review('보존할 초안');
    vi.mocked(post).mockResolvedValueOnce(
      response({ sourceId: 3, kind: 'metrics', entries: [{ id: 1, title: '활성 매출 지표' }], nextAfterId: null }),
    );
    fireEvent.click(screen.getByRole('button', { name: '이 소스의 사용처 확인' }));
    await screen.findByText('활성 매출 지표');
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('보존할 초안');
    expect(screen.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(false);
    expect(vi.mocked(post).mock.calls.some(([url]) => url === '/bi/source-catalog/save')).toBe(false);
  });
});

it('keeps shared metadata readable but disables edits and does not expose owner usage', async () => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(data()));
  render(<SourceCatalogEditor sourceId={3} canEdit={false} canInspectUsage={false} />);
  await open();
  expect(screen.getByLabelText('소스 표시명').closest('fieldset')?.disabled).toBe(true);
  expect((screen.getByRole('button', { name: '변경 내용 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
  expect(vi.mocked(post).mock.calls.map(call => call[0])).toEqual(['/bi/source-catalog/read']);
  expect(screen.queryByText('이 소스의 사용처')).toBeNull();
});

it('keeps variable declarations through preview consent save and remount, with fresh consent on edit', async () => {
  vi.resetAllMocks();
  const initial = {
    ...data(),
    columns: [{ ...data().columns[0], type: 'VARCHAR', businessType: 'auto', dateFormat: '', classification: '' }],
  };
  vi.mocked(post).mockResolvedValue(response(initial));
  const view = render(<SourceCatalogEditor sourceId={3} />);
  await open();
  fireEvent.change(screen.getByLabelText('amount 업무 유형'), { target: { value: 'date' } });
  expect((screen.getByLabelText('amount 날짜 형식') as HTMLSelectElement).value).toBe('YYYY-MM-DD');
  fireEvent.change(screen.getByLabelText('amount 날짜 형식'), { target: { value: 'YYYYMMDD' } });
  fireEvent.change(screen.getByLabelText('amount 업무 분류'), { target: { value: '결제' } });
  const declared = {
    ...draft('주문'),
    columns: [{ ...draft('주문').columns[0], businessType: 'date', dateFormat: 'YYYYMMDD', classification: '결제' }],
  };
  const changes = [
    { column: 'amount', field: 'businessType', before: 'auto', after: 'date' },
    { column: 'amount', field: 'dateFormat', before: '', after: 'YYYYMMDD' },
    { column: 'amount', field: 'classification', before: '', after: '결제' },
  ];
  vi.mocked(post).mockResolvedValueOnce(response({ draft: declared, changes }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText('저장 전 변경 3개');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/preview', declared);
  fireEvent.click(screen.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' }));
  fireEvent.change(screen.getByLabelText('amount 업무 분류'), { target: { value: '판매' } });
  expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  declared.columns[0].classification = '판매';
  changes[2].after = '판매';
  vi.mocked(post).mockResolvedValueOnce(response({ draft: declared, changes }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText('저장 전 변경 3개');
  fireEvent.click(screen.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다' }));
  const saved = { ...initial, version: 1, columns: [{ ...declared.columns[0], type: 'VARCHAR' }] };
  vi.mocked(post).mockResolvedValueOnce(response(saved));
  fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
  await screen.findByText('업무 설명을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/save', declared);
  view.unmount();
  vi.mocked(post).mockResolvedValue(response(saved));
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  expect((screen.getByLabelText('amount 업무 유형') as HTMLSelectElement).value).toBe('date');
  expect((screen.getByLabelText('amount 날짜 형식') as HTMLSelectElement).value).toBe('YYYYMMDD');
  expect((screen.getByLabelText('amount 업무 분류') as HTMLInputElement).value).toBe('판매');
});
it('preserves a bad date proposal on 400 and clears the format only when the type changes', async () => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(data()));
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  fireEvent.change(screen.getByLabelText('amount 업무 유형'), { target: { value: 'date' } });
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 400 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText(/업무 유형·날짜 형식을 확인/);
  expect((screen.getByLabelText('amount 업무 유형') as HTMLSelectElement).value).toBe('date');
  expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('amount 업무 유형'), { target: { value: 'number' } });
  expect((screen.getByLabelText('amount 날짜 형식') as HTMLSelectElement).value).toBe('');
  expect((screen.getByLabelText('amount 날짜 형식') as HTMLSelectElement).disabled).toBe(true);
});
it('rejects malformed semantic metadata rather than silently replacing it with legacy defaults', async () => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(
    response({ ...data(), columns: [{ ...data().columns[0], businessType: 'date', dateFormat: 'SQL' }] }),
  );
  render(<SourceCatalogEditor sourceId={3} />);
  fireEvent.click(screen.getByRole('button', { name: '데이터 업무 설명' }));
  await screen.findByText(/업무 설명을 불러오지 못했습니다/);
  expect(screen.queryByLabelText('amount 표시명')).toBeNull();
});

it('explains invalid and blank date counts while keeping the proposal and raw values private', async () => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(data()));
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  fireEvent.change(screen.getByLabelText('amount 업무 유형'), { target: { value: 'date' } });
  vi.mocked(post).mockRejectedValueOnce({
    response: {
      status: 400,
      data: {
        data: {
          code: 'INVALID_BUSINESS_DATES',
          details: [
            { column: 'amount', invalidCount: '7', blankCount: '2' },
            { column: 'foreign', invalidCount: '3', blankCount: '1' },
          ],
        },
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText(/amount 7개 \(빈 문자열 2개\)/);
  expect(screen.queryByText(/foreign/)).toBeNull();
  expect((screen.getByLabelText('amount 업무 유형') as HTMLSelectElement).value).toBe('date');
  expect((screen.getByRole('button', { name: '확인한 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

const ref = { organizationId: 7, id: 4, version: 1 };
it('keeps frozen bound labels/refs without registry reads and accepts a same-name ref-only preview change', async () => {
  const input = { ...data(), columns: [{ ...data().columns[0], classification: '매출', classificationRef: ref }] };
  vi.mocked(post).mockResolvedValueOnce(response(input));
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  expect((screen.getByLabelText('amount 업무 분류') as HTMLInputElement).readOnly).toBe(true);
  expect(get).not.toHaveBeenCalled();
  vi.mocked(get).mockResolvedValue({
    data: {
      actorId: 1,
      organizationId: 7,
      canManage: false,
      entries: [{ id: 4, name: '매출', active: true, version: 2 }],
      nextAfterId: null,
    },
  } as any);
  fireEvent.click(screen.getByRole('button', { name: '공통 분류 불러오기' }));
  await screen.findByLabelText('amount 공통 분류');
  fireEvent.change(screen.getByLabelText('amount 공통 분류'), { target: { value: '4' } });
  await waitFor(() => expect(screen.getByText(/분류 4 · 버전 2/)).toBeTruthy());
  const request = {
    ...draft('주문'),
    columns: [{ ...draft('주문').columns[0], classification: '매출', classificationRef: { ...ref, version: 2 } }],
  };
  vi.mocked(post).mockResolvedValueOnce(
    response({
      draft: request,
      changes: [
        {
          column: 'amount',
          field: 'classificationRef',
          before: JSON.stringify(ref),
          after: JSON.stringify({ ...ref, version: 2 }),
        },
      ],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText('amount · 공통 분류 연결');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/preview', request);
  expect(screen.getByText('조직 7 · 분류 4 · 버전 2')).toBeTruthy();
});
it('preserves explicit null detach through preview/save then permits free-label editing after saved null', async () => {
  const input = { ...data(), columns: [{ ...data().columns[0], classification: '기존 이름', classificationRef: ref }] };
  vi.mocked(post).mockResolvedValueOnce(response(input));
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  fireEvent.click(screen.getByRole('button', { name: '공통 분류 연결 해제' }));
  expect((screen.getByLabelText('amount 업무 분류') as HTMLInputElement).readOnly).toBe(true);
  const request = {
    ...draft('주문'),
    columns: [{ ...draft('주문').columns[0], classification: '기존 이름', classificationRef: null }],
  };
  vi.mocked(post).mockResolvedValueOnce(
    response({
      draft: request,
      changes: [{ column: 'amount', field: 'classificationRef', before: JSON.stringify(ref), after: null }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText('amount · 공통 분류 연결');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/preview', request);
  fireEvent.click(screen.getByRole('checkbox', { name: /변경 내용을 확인/ }));
  vi.mocked(post).mockResolvedValueOnce(
    response({ ...input, version: 1, columns: [{ ...input.columns[0], classificationRef: null }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '확인한 변경 저장' }));
  await screen.findByText('업무 설명을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-catalog/save', request);
  expect((screen.getByLabelText('amount 업무 분류') as HTMLInputElement).readOnly).toBe(false);
  fireEvent.change(screen.getByLabelText('amount 업무 분류'), { target: { value: '자유 분류명' } });
  expect((screen.getByLabelText('amount 업무 분류') as HTMLInputElement).value).toBe('자유 분류명');
});
it('does not drop an existing ref when a preview response omits it', async () => {
  vi.mocked(post).mockResolvedValueOnce(
    response({
      ...data(),
      columns: [{ ...data().columns[0], classification: '과거 이름', classificationRef: { ...ref, organizationId: 99 } }],
    }),
  );
  render(<SourceCatalogEditor sourceId={3} />);
  await open();
  fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '변경' } });
  vi.mocked(post).mockResolvedValueOnce(
    response({ draft: draft('변경'), changes: [{ column: null, field: 'label', before: '주문', after: '변경' }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 미리보기' }));
  await screen.findByText(/변경 내용을 확인하지 못했습니다/);
  expect(screen.getByText(/조직 99 · 분류 4 · 버전 1/)).toBeTruthy();
});
