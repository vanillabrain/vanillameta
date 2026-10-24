import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioPublish from './StudioPublish';
import { fetchOwnerPublication, publishDashboard, revokePublication } from './studioPublication';
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
const localInput = (offsetDays: number) => {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
describe('publication expiry', () => {
  it('tells the owner a blank expiry means 30 days and that 30 days is the longest', async () => {
    render(<StudioPublish {...props} />);
    await screen.findByRole('button', { name: '게시하기' });
    expect(screen.getByText(/비워 두면 게시 시점부터 30일 뒤에 만료됩니다/)).toBeTruthy();
    expect(screen.getByText(/최대 30일까지 지정할 수 있고/)).toBeTruthy();
  });
  it('refuses an expiry more than 30 days away without sending the request', async () => {
    render(<StudioPublish {...props} />);
    const publish = await screen.findByRole('button', { name: '게시하기' });
    fireEvent.change(screen.getByLabelText('링크 만료 시각 (내 시간대)'), {
      target: { value: localInput(31) },
    });
    fireEvent.click(publish);
    expect(await screen.findByText(/최대 30일 뒤까지 선택해 주세요/)).toBeTruthy();
    expect(publishDashboard).not.toHaveBeenCalled();
  });
  it('sends an expiry inside the limit, and none when the field is blank (the server picks 30 days)', async () => {
    render(<StudioPublish {...props} />);
    const publish = await screen.findByRole('button', { name: '게시하기' });
    fireEvent.click(publish);
    await waitFor(() => expect(publishDashboard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publishDashboard).mock.calls[0][1]).not.toHaveProperty('expiresAt');
  });
  it('sends the chosen expiry when it is within 30 days', async () => {
    render(<StudioPublish {...props} />);
    const publish = await screen.findByRole('button', { name: '게시하기' });
    fireEvent.change(screen.getByLabelText('링크 만료 시각 (내 시간대)'), {
      target: { value: localInput(10) },
    });
    fireEvent.click(publish);
    await waitFor(() => expect(publishDashboard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publishDashboard).mock.calls[0][1]).toHaveProperty('expiresAt');
  });
  it('warns that republishing a link without an expiry gives it one', async () => {
    vi.mocked(fetchOwnerPublication)
      .mockReset()
      .mockResolvedValue({ ...metadata, visibility: 'link' });
    render(<StudioPublish {...props} />);
    expect(await screen.findByText(/설정하지 않음 · 재게시하면 30일 만료가 적용됩니다/)).toBeTruthy();
  });
});
describe('snapshot publication controls', () => {
  it('uses a named, described portal and restores keyboard focus to the opener after Escape', async () => {
    function Host() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>게시 설정 열기</button>
          <StudioPublish {...props} open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    const view = render(<Host />);
    const opener = screen.getByRole('button', { name: '게시 설정 열기' });
    opener.focus();
    userEvent.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: '게시·공유' });
    expect(view.container.contains(dialog)).toBe(false);
    const description = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('저장한 대시보드를 읽기 전용으로 게시');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(publishDashboard).not.toHaveBeenCalled();
    expect(revokePublication).not.toHaveBeenCalled();
  });
  it('keeps the dialog open and locks settings during publication, then permits Escape after failure', async () => {
    let rejectPublish: (cause: Error) => void = () => {
      throw new Error('request not started');
    };
    vi.mocked(publishDashboard).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectPublish = reject;
        }),
    );
    render(<StudioPublish {...props} />);
    const publish = await screen.findByRole('button', { name: '게시하기' });
    await waitFor(() => expect((publish as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(publish);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: '닫기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /링크 공개/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => rejectPublish(new Error('lost response')));
    await screen.findByRole('button', { name: '같은 요청 재시도' });
    expect((screen.getByRole('radio', { name: /링크 공개/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(publishDashboard).toHaveBeenCalledOnce();
  });
  it('keeps the link read-only and selects it when clipboard access fails', async () => {
    vi.mocked(fetchOwnerPublication).mockReset().mockResolvedValue(metadata);
    render(<StudioPublish {...props} />);
    const link = (await screen.findByRole('textbox', { name: '게시 링크' })) as HTMLInputElement;
    expect(link.readOnly).toBe(true);
    expect(screen.getByRole('link', { name: '게시본 열기' }).getAttribute('href')).toBe(link.value);
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await screen.findByText(/선택된 링크를 직접 복사/);
    expect(document.activeElement).toBe(link);
    expect(link.selectionStart).toBe(0);
    expect(link.selectionEnd).toBe(link.value.length);
    expect(publishDashboard).not.toHaveBeenCalled();
  });
  it('requires revoke confirmation and blocks Escape while revoking', async () => {
    vi.mocked(fetchOwnerPublication).mockReset().mockResolvedValue(metadata);
    let finishRevoke: () => void = () => {
      throw new Error('request not started');
    };
    vi.mocked(revokePublication).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishRevoke = () => resolve(undefined);
        }),
    );
    render(<StudioPublish {...props} />);
    const revoke = await screen.findByRole('button', { name: '게시 중지' });
    await waitFor(() => expect((revoke as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(revoke);
    expect(revokePublication).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '유지' }));
    expect(screen.queryByRole('button', { name: '중지 확인' })).toBeNull();
    fireEvent.click(revoke);
    fireEvent.click(screen.getByRole('button', { name: '중지 확인' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => finishRevoke());
    await screen.findByText(/게시를 중지했습니다/);
    expect(revokePublication).toHaveBeenCalledWith(metadata.token);
    expect(screen.queryByRole('textbox', { name: '게시 링크' })).toBeNull();
  });
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
    const permission = screen.getByRole('checkbox', { name: '내 데이터로 복제 허용' });
    expect(permission.getAttribute('aria-checked')).toBe('false');
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

it('UC038 pins the recovery link to the publication target and locks stale publication across close/reopen', async () => {
  vi.mocked(publishDashboard).mockRejectedValueOnce({ response: { status: 409 } });
  const view = render(<StudioPublish {...props} targetLabel="새 대시보드 #8 · 생성안 저장 버전 기준" />);
  await waitFor(() => expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  const link = await screen.findByRole('link', { name: '최신 저장본 확인' });
  expect(link.getAttribute('href')).toBe('/dashboard/8/studio');
  expect(link.getAttribute('target')).toBe('_blank');
  expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  expect(publishDashboard).toHaveBeenCalledOnce();
  view.rerender(<StudioPublish {...props} open={false} />);
  view.rerender(<StudioPublish {...props} />);
  await screen.findByRole('link', { name: '최신 저장본 확인' });
  await waitFor(() => expect(fetchOwnerPublication).toHaveBeenCalledTimes(2));
  expect((screen.getByRole('button', { name: '재게시' }) as HTMLButtonElement).disabled).toBe(true);
  expect(publishDashboard).toHaveBeenCalledOnce();
});
it('UC038 unlocks only when the parent supplies a different saved revision', async () => {
  vi.mocked(publishDashboard).mockRejectedValueOnce({ response: { status: 409 } });
  const view = render(<StudioPublish {...props} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  await screen.findByRole('link', { name: '최신 저장본 확인' });
  view.rerender(<StudioPublish {...props} revision={'c'.repeat(64)} />);
  await waitFor(() => expect(screen.queryByRole('link', { name: '최신 저장본 확인' })).toBeNull());
  expect(screen.queryByText(/저장 내용이 변경되었습니다/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  await screen.findByText(/버전 1 게시 완료/);
  expect(vi.mocked(publishDashboard).mock.calls[1][1].expectedRevision).toBe('c'.repeat(64));
});
it('UC038 locks again if a newly supplied revision also conflicts without auto retry or publication', async () => {
  vi.mocked(publishDashboard).mockRejectedValue({ response: { status: 409 } });
  const view = render(<StudioPublish {...props} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  await screen.findByRole('link', { name: '최신 저장본 확인' });
  view.rerender(<StudioPublish {...props} revision={'d'.repeat(64)} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false));
  expect(publishDashboard).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  await screen.findByRole('link', { name: '최신 저장본 확인' });
  expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(publishDashboard).toHaveBeenCalledTimes(2);
  expect(vi.mocked(publishDashboard).mock.calls[1][1].expectedRevision).toBe('d'.repeat(64));
});

it('UC038 A2 preserves the active publication and link through two conflicts, then republishes only the explicitly confirmed latest revision', async () => {
  const active = { ...metadata, visibility: 'link' as const };
  vi.mocked(fetchOwnerPublication).mockReset().mockResolvedValue(active);
  vi.mocked(publishDashboard)
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({ ...active, version: 2 });
  const view = render(<StudioPublish {...props} />);
  await screen.findByText('버전 1');
  const originalLink = (screen.getByRole('textbox', { name: '게시 링크' }) as HTMLInputElement).value;
  for (const revision of [props.revision, 'c'.repeat(64)]) {
    view.rerender(<StudioPublish {...props} revision={revision} />);
    await waitFor(() => expect((screen.getByRole('button', { name: '재게시' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '재게시' }));
    await screen.findByRole('link', { name: '최신 저장본 확인' });
    expect((screen.getByRole('button', { name: '재게시' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '게시 링크' }) as HTMLInputElement).value).toBe(originalLink);
    expect(screen.getByText('버전 1')).toBeDefined();
    expect(screen.getByRole('radio', { name: /링크 공개/ }).getAttribute('aria-checked')).toBe('true');
    expect(revokePublication).not.toHaveBeenCalled();
  }
  expect(publishDashboard).toHaveBeenCalledTimes(2);
  view.rerender(<StudioPublish {...props} revision={'d'.repeat(64)} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '재게시' }) as HTMLButtonElement).disabled).toBe(false));
  expect(publishDashboard).toHaveBeenCalledTimes(2);
  vi.mocked(fetchOwnerPublication).mockResolvedValue({ ...active, version: 2 });
  fireEvent.click(screen.getByRole('button', { name: '재게시' }));
  await screen.findByText(/버전 2 게시 완료/);
  expect(publishDashboard).toHaveBeenCalledTimes(3);
  expect(vi.mocked(publishDashboard).mock.calls.map(([, body]) => body.expectedRevision)).toEqual([
    props.revision,
    'c'.repeat(64),
    'd'.repeat(64),
  ]);
  expect((screen.getByRole('textbox', { name: '게시 링크' }) as HTMLInputElement).value).toBe(originalLink);
});

it('disables unsupported remix and sends false even if the previous publication allowed it', async () => {
  const reason =
    '집계 Pivot은 같은 소스의 Studio 저장본 복제만 지원합니다. 다른 데이터/수신자 재사용은 아직 지원하지 않습니다.';
  vi.mocked(fetchOwnerPublication)
    .mockReset()
    .mockResolvedValue({ ...metadata, allowRemix: true });
  render(<StudioPublish {...props} remixUnsupportedReason={reason} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '재게시' }) as HTMLButtonElement).disabled).toBe(false));
  const checkbox = screen.getByRole('checkbox', { name: '내 데이터로 복제 허용' });
  expect((checkbox as HTMLButtonElement).disabled).toBe(true);
  expect(checkbox.getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText(reason)).toBeTruthy();
  expect(screen.queryByText(/허용하면 원본 열 이름/)).toBeNull();
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: '재게시' }));
  await waitFor(() => expect(publishDashboard).toHaveBeenCalledOnce());
  expect(vi.mocked(publishDashboard).mock.calls[0][1].allowRemix).toBe(false);
});
it('keeps an already pending publication envelope intact when an unsupported reason arrives', async () => {
  vi.mocked(publishDashboard).mockRejectedValueOnce(new Error('lost response'));
  const view = render(<StudioPublish {...props} />);
  await waitFor(() => expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('checkbox', { name: '내 데이터로 복제 허용' }));
  fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
  await screen.findByRole('button', { name: '같은 요청 재시도' });
  const body = structuredClone(vi.mocked(publishDashboard).mock.calls[0][1]);
  expect(body.allowRemix).toBe(true);
  view.rerender(<StudioPublish {...props} remixUnsupportedReason="Pivot 재사용 미지원" />);
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: '같은 요청 재시도' }));
  await waitFor(() => expect(publishDashboard).toHaveBeenCalledTimes(2));
  expect(vi.mocked(publishDashboard).mock.calls[1][1]).toEqual(body);
});

it('shows the supplied saved basis even with dirty changes and never borrows another creation basis', async () => {
  const view = render(
    <StudioPublish
      {...props}
      dirty
      basis={{ data: '저장 소스 #4', period: '저장 기간 UTC', filters: 'channel: "web"', metrics: '매출 · v2' }}
    />,
  );
  await screen.findByRole('button', { name: '게시하기' });
  expect(screen.getAllByText('저장 소스 #4').length).toBeGreaterThan(0);
  expect(screen.getByText(/저장되지 않은 변경이 있습니다/)).toBeTruthy();
  expect(publishDashboard).not.toHaveBeenCalled();
  view.rerender(<StudioPublish {...props} dashboardId={99} />);
  expect(screen.queryByText('저장 소스 #4')).toBeNull();
  expect(screen.getAllByText('저장한 대시보드 #99').length).toBeGreaterThan(0);
});
