import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioRemix from './StudioRemix';
import { fetchRemixRequirements, previewRemix, saveRemix } from './studioRemixApi';
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ token: 'a'.repeat(64) }), useNavigate: () => navigate }));
vi.mock('@mui/material', () => ({
  Alert: ({ children, role }: any) => <div role={role ?? 'alert'}>{children}</div>,
  Button: ({ children, onClick, disabled }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Checkbox: ({ checked, onChange, disabled }: any) => (
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
  ),
  FormControlLabel: ({ label, control }: any) => (
    <label>
      {control}
      {label}
    </label>
  ),
}));
vi.mock('./StudioSourcePicker', () => ({
  default: ({ onSource, busy }: any) => (
    <button disabled={busy} onClick={() => onSource(22)}>
      내 파일 선택
    </button>
  ),
}));
vi.mock('./PublishedDashboard', () => ({ PublishedBlockView: ({ block }: any) => <div>{block.title}</div> }));
vi.mock('./studioCreation', () => ({
  fetchStudioSources: vi.fn().mockResolvedValue([{ id: 22, name: 'Own' }]),
  creationData: (x: any) => x,
}));
vi.mock('./studioApi', () => ({ studioRequestId: () => 'remix-request' }));
vi.mock('@/api/databaseService', () => ({ default: {} }));
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('./studioRemixApi', async () => ({
  ...(await vi.importActual<any>('./studioRemixApi')),
  fetchRemixRequirements: vi.fn(),
  previewRemix: vi.fn(),
  saveRemix: vi.fn(),
}));
const requirements = {
  token: 'a'.repeat(64),
  version: 6,
  title: 'Shared',
  requiredFields: [{ name: 'amount', type: 'BIGINT', blockIds: ['block-1'] }],
  blocks: [{ id: 'block-1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
};
const preview: any = {
  ...requirements,
  targetSourceId: 22,
  sourceRevision: 'b'.repeat(64),
  profile: {
    sourceId: 22,
    rowCount: '2',
    columns: [
      { name: 'amount', type: 'BIGINT' },
      { name: 'text_amount', type: 'VARCHAR' },
    ],
  },
  mapping: { amount: 'amount' },
  fields: [
    { sourceColumn: 'amount', sourceType: 'BIGINT', targetColumn: 'amount', status: 'mapped', candidates: ['amount'] },
  ],
  unmappedBlocks: [],
  preview: {
    widgets: [{ title: 'Total', type: 'BOARD_NUMERIC', valueField: 'value', datas: [{ value: 500 }], fields: [] }],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('accessToken', JSON.stringify('synthetic-user-one'));
  vi.mocked(fetchRemixRequirements).mockResolvedValue(requirements);
  vi.mocked(previewRemix).mockResolvedValue(preview);
  vi.mocked(saveRemix).mockResolvedValue({ dashboardId: 44, document: {} } as any);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const ready = async () => {
  render(<StudioRemix />);
  const choose = await screen.findByRole('button', { name: '내 파일 선택' });
  await waitFor(() => expect((choose as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(choose);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }) as HTMLButtonElement).disabled).toBe(false),
  );
};
describe('remix save and actor boundaries', () => {
  it('invalidates preview when a mapping is cleared and sends the explicit empty choice for revalidation', async () => {
    await ready();
    fireEvent.change(screen.getByRole('combobox', { name: '대상 열: amount' }), { target: { value: '' } });
    expect((screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '매핑 확인' }));
    await waitFor(() => expect(previewRemix).toHaveBeenCalledTimes(2));
    expect(vi.mocked(previewRemix).mock.calls[1][1].mapping).toEqual({ amount: '' });
    expect(saveRemix).not.toHaveBeenCalled();
  });
  it('keeps the incompatible selected column visible so the user can correct it', async () => {
    await ready();
    vi.mocked(previewRemix).mockResolvedValueOnce({
      ...preview,
      mapping: {},
      fields: [{ ...preview.fields[0], targetColumn: 'text_amount', status: 'incompatible' }],
      unmappedBlocks: [{ blockId: 'block-1', title: 'Total', reason: 'type', missingFields: ['amount'] }],
    });
    fireEvent.change(screen.getByRole('combobox', { name: '대상 열: amount' }), { target: { value: 'text_amount' } });
    fireEvent.click(screen.getByRole('button', { name: '매핑 확인' }));
    await screen.findByText('BIGINT · 형식 불일치');
    const select = screen.getByRole('combobox', { name: '대상 열: amount' }) as HTMLSelectElement;
    expect(select.value).toBe('text_amount');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('retries exactly the pinned save after a lost response and locks the source', async () => {
    vi.mocked(saveRemix).mockRejectedValueOnce(new Error('lost response'));
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }));
    const retry = await screen.findByRole('button', { name: '같은 복제 저장 재시도' });
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole('button', { name: '내 파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard/44/studio'));
    expect(vi.mocked(saveRemix).mock.calls[1]).toEqual(vi.mocked(saveRemix).mock.calls[0]);
  });
  it('accepts a save after the same account refreshes its access token', async () => {
    const token = (iat: number) =>
      'header.' + btoa(JSON.stringify({ accessKeyData: { id: 5, userId: 'synthetic' }, iat })) + '.signature';
    localStorage.setItem('accessToken', JSON.stringify(token(1)));
    vi.mocked(saveRemix).mockImplementationOnce(async () => {
      localStorage.setItem('accessToken', JSON.stringify(token(2)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
      return { dashboardId: 44, document: {} } as any;
    });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard/44/studio'));
  });
  it('ignores a completed save from the previous account after logout', async () => {
    let resolveSave: (x: any) => void = () => {
      throw new Error('save not started');
    };
    vi.mocked(saveRemix).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSave = resolve;
        }),
    );
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '새 비공개 대시보드 만들기' }));
    localStorage.removeItem('accessToken');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' })));
    await screen.findByText('내 데이터를 쓰려면 로그인해 주세요');
    await act(async () => resolveSave({ dashboardId: 44, document: {} }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '같은 복제 저장 재시도' })).toBeNull();
  });
});
