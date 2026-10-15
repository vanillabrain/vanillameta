import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioPublish from './StudioPublish';
import { fetchOwnerPublication, publishDashboard } from './studioPublication';
vi.mock('@mui/material', () => ({
  Dialog: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogActions: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Radio: () => null,
  Checkbox: ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={onChange} />,
  RadioGroup: ({ children, value, onChange }: any) => (
    <div onChange={onChange} data-value={value}>
      {children}
    </div>
  ),
  FormControlLabel: ({ value, label, control }: any) => (
    <label>
      {control?.props?.onChange ? control : <input type="radio" name="scope" value={value} />}
      {label}
    </label>
  ),
  TextField: ({ label, value, onChange, type, inputRef }: any) => (
    <label>
      {label}
      <input ref={inputRef} aria-label={label} type={type} value={value} onChange={onChange} readOnly={!onChange} />
    </label>
  ),
}));
vi.mock('./studioApi', () => ({ studioRequestId: () => 'stable-request-id' }));
vi.mock('./studioPublication', async () => ({
  ...(await vi.importActual<any>('./studioPublication')),
  fetchOwnerPublication: vi.fn(),
  publishDashboard: vi.fn(),
  revokePublication: vi.fn(),
}));
const metadata = {
  token: 'a'.repeat(64),
  version: 1,
  visibility: 'private' as const,
  allowRemix: false,
  expiresAt: null,
  asOf: '2026-10-15T00:00:00.000Z',
};
const props = { open: true, onClose: vi.fn(), dashboardId: 8, revision: 'b'.repeat(64), dirty: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchOwnerPublication).mockReset().mockResolvedValueOnce(null).mockResolvedValue(metadata);
  vi.mocked(publishDashboard).mockResolvedValue(metadata);
});
afterEach(cleanup);
describe('snapshot publication controls', () => {
  it('starts private and publishes only after explicit confirmation', async () => {
    render(<StudioPublish {...props} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(publishDashboard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByText(/버전 1 게시 완료/);
    expect(publishDashboard).toHaveBeenCalledWith(8, {
      requestId: 'stable-request-id',
      expectedRevision: props.revision,
      visibility: 'private',
      allowRemix: false,
    });
  });
  it('shares reusable column/metric definitions only after explicit remix consent', async () => {
    render(<StudioPublish {...props} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false),
    );
    const permission = screen.getByRole('checkbox', { name: '내 데이터로 복제 허용' }) as HTMLInputElement;
    expect(permission.checked).toBe(false);
    expect(screen.getByText(/원본 열 이름과 지표 정의/)).toBeTruthy();
    fireEvent.click(permission);
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByText(/버전 1 게시 완료/);
    expect(vi.mocked(publishDashboard).mock.calls[0][1].allowRemix).toBe(true);
  });
  it('retries the exact same body after a lost response', async () => {
    vi.mocked(publishDashboard).mockRejectedValueOnce(new Error('lost response'));
    render(<StudioPublish {...props} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('radio', { name: /링크 공개/ }));
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByRole('button', { name: '같은 요청 재시도' });
    fireEvent.click(screen.getByRole('button', { name: '같은 요청 재시도' }));
    await screen.findByText(/버전 1 게시 완료/);
    expect(vi.mocked(publishDashboard).mock.calls[1]).toEqual(vi.mocked(publishDashboard).mock.calls[0]);
    expect(vi.mocked(publishDashboard).mock.calls[0][1].visibility).toBe('link');
  });
  it('does not call a revoked idempotent receipt a successful publication', async () => {
    vi.mocked(publishDashboard).mockResolvedValueOnce({ ...metadata, revokedAt: '2026-10-15T01:00:00Z' });
    render(<StudioPublish {...props} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByText(/이미 중지되었습니다/);
    expect(screen.queryByText(/게시 완료/)).toBeNull();
    expect(screen.queryByLabelText('게시 링크')).toBeNull();
  });
  it('refreshes stable-link scope when another republish follows a replay receipt', async () => {
    vi.mocked(fetchOwnerPublication)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ ...metadata, version: 2, visibility: 'private' });
    vi.mocked(publishDashboard).mockResolvedValueOnce({ ...metadata, visibility: 'link' });
    render(<StudioPublish {...props} />);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await screen.findByText(/이후 변경된 최신 게시본/);
    expect(screen.getByText('버전 2')).toBeTruthy();
    expect(screen.getByText('비공개 · 소유자만')).toBeTruthy();
    expect(screen.queryByText('링크가 있는 모든 사람')).toBeNull();
  });
  it('blocks dirty drafts and failed owner status checks', async () => {
    const view = render(<StudioPublish {...props} dirty />);
    await screen.findByText(/저장되지 않은 변경/);
    expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(true);
    view.unmount();
    vi.mocked(fetchOwnerPublication).mockRejectedValueOnce(new Error('offline'));
    render(<StudioPublish {...props} />);
    await screen.findByRole('button', { name: '게시 상태 다시 확인' });
    expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(true);
    expect(publishDashboard).not.toHaveBeenCalled();
  });
});
