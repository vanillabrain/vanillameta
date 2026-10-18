import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import GroupDeliveries from './GroupDeliveries';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const group = { id: 7, name: 'Operations', active: true, version: 3 };
const open = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 열기' }));
const load = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 최신 읽기 · 초안 초기화' }));
const save = () => fireEvent.click(screen.getByRole('button', { name: '그룹 공유 변경 저장' }));
async function choose() {
  await screen.findByRole('option', { name: 'Operations · v3' });
  fireEvent.change(screen.getByRole('combobox', { name: '공유할 그룹' }), { target: { value: '7' } });
}
const ack = () => fireEvent.click(screen.getByRole('checkbox', { name: /그룹 전체·향후/ }));
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/enterprise/groups' ? { entries: [group], nextAfterId: null } : { dashboardId: 20, entries: [] },
    }),
  );
  api.post.mockImplementation((_url: string, body: any) =>
    Promise.resolve({
      data: {
        requestId: body.requestId,
        dashboardId: 20,
        entry: { groupId: body.groupId, version: 1, active: body.active, allowCopy: body.allowCopy },
        replayed: false,
      },
    }),
  );
});
afterEach(cleanup);
it('requires explicit load, group effect consent and saves a versioned current/future membership relation', async () => {
  render(<GroupDeliveries dashboardId={20} />);
  open();
  expect(api.get).not.toHaveBeenCalled();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '내 소스로 독립 복제 허용' }));
  expect(screen.getByText(/조회 공유: 중지 → 활성/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  ack();
  save();
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[0][1]).toMatchObject({
    groupId: 7,
    expectedGroupVersion: 3,
    expectedVersion: 0,
    active: true,
    allowCopy: true,
  });
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('combobox', { name: '공유할 그룹' }).className).toContain('h-9');
  expect(screen.getByRole('combobox', { name: '공유할 그룹' }).className).toContain('text-base');
});
it('freezes the exact body after response loss and explicitly rechecks it before new writes', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<GroupDeliveries dashboardId={20} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByText(/결과가 불명확합니다/);
  fireEvent.click(screen.getByRole('button', { name: '그룹 공유 접기' }));
  expect(screen.queryByRole('button', { name: '같은 그룹 공유 요청 확인' })).toBeNull();
  open();
  const confirm = screen.getByRole('button', { name: '같은 그룹 공유 요청 확인' });
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByRole('combobox', { name: '공유할 그룹' }) as HTMLSelectElement).disabled).toBe(true);
  const first = structuredClone(api.post.mock.calls[0][1]);
  fireEvent.click(confirm);
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[1][1]).toEqual(first);
  expect(api.post).toHaveBeenCalledTimes(2);
});
it('preserves the draft on 409 and requires an explicit reset read', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<GroupDeliveries dashboardId={20} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByRole('button', { name: '그룹 공유 변경 저장' });
  expect((screen.getByRole('checkbox', { name: '조회 공유 활성' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('button', { name: '그룹 공유 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  load();
  await waitFor(() => expect((screen.getByRole('combobox', { name: '공유할 그룹' }) as HTMLSelectElement).value).toBe(''));
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('drops a late response after unmount and permits inactive group revocation only', async () => {
  let resolve!: (value: any) => void;
  api.get.mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = render(<GroupDeliveries dashboardId={20} />);
  open();
  load();
  view.unmount();
  await act(async () => resolve({ data: { dashboardId: 20, entries: [] } }));
  expect(screen.queryByRole('combobox')).toBeNull();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [{ ...group, active: false }], nextAfterId: null }
          : { dashboardId: 20, entries: [{ groupId: 7, version: 2, active: true, allowCopy: true }] },
    }),
  );
  render(<GroupDeliveries dashboardId={20} />);
  open();
  load();
  await screen.findByRole('option', { name: 'Operations · v3 · 비활성' });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '조회 공유 활성' }));
  ack();
  save();
  await screen.findByText(/그룹 공유를 저장했습니다/);
  expect(api.post.mock.calls[0][1]).toMatchObject({ active: false, allowCopy: false, expectedVersion: 2 });
});
