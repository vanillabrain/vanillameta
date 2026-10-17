import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SourceCatalogEditor from './SourceCatalogEditor';
import { post } from '@/helpers/apiHelper';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
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
describe('UC050 business metadata editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(post).mockResolvedValue(response(data()));
  });
  it('starts collapsed without a request, explicitly reads and saves, then reloads the saved version', async () => {
    const view = render(<SourceCatalogEditor sourceId={3} />);
    expect(post).not.toHaveBeenCalled();
    await open();
    fireEvent.change(screen.getByLabelText('소스 표시명'), { target: { value: '결제 내역' } });
    vi.mocked(post).mockResolvedValueOnce(response({ ...data(), label: '결제 내역', version: 1 }));
    fireEvent.click(screen.getByRole('button', { name: '업무 설명 저장' }));
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
    vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
    fireEvent.click(screen.getByRole('button', { name: '업무 설명 저장' }));
    await screen.findByText(/다른 창 또는 데이터가 변경/);
    expect((screen.getByLabelText('소스 표시명') as HTMLInputElement).value).toBe('내 초안');
    fireEvent.click(screen.getByRole('button', { name: '최신 설명 다시 읽기' }));
    expect(post).toHaveBeenCalledTimes(2);
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
    expect((screen.getByRole('button', { name: '업무 설명 저장' }) as HTMLButtonElement).disabled).toBe(true);
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
    expect(screen.queryByRole('button', { name: '업무 설명 저장' })).toBeNull();
  });
});
