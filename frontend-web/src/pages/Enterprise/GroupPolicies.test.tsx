import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import GroupPolicies from './GroupPolicies';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const empty = { read: false, edit: false, publish: false, export: false };
const group = { id: 7, name: 'Ops', active: true, version: 3 };
const policy = { groupId: 7, version: 2, rights: { ...empty, read: true, edit: true } };
const open = () => fireEvent.click(screen.getByRole('button', { name: '그룹 권한 열기' }));
const load = () => fireEvent.click(screen.getByRole('button', { name: '그룹 권한 최신 읽기 (초안 초기화)' }));
const choose = async () => {
  await screen.findByRole('option', { name: 'Ops · #7 · 활성' });
  fireEvent.change(screen.getByRole('combobox', { name: '권한 대상 그룹' }), { target: { value: '7' } });
};
const ack = () => fireEvent.click(screen.getByRole('checkbox', { name: /구성원에게 적용할 권한/ }));
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [group], nextAfterId: null }
          : { kind: 'source', resourceId: 10, entries: [policy] },
    }),
  );
  api.post.mockImplementation((_url: string, body: any) =>
    Promise.resolve({ data: { kind: 'source', resourceId: 10, groupId: 7, version: 3, rights: body.rights } }),
  );
});
afterEach(cleanup);
it('does not read until requested, requires read and confirms a versioned group-policy diff', async () => {
  render(<GroupPolicies kind="source" resourceId={10} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  expect(api.get).not.toHaveBeenCalled();
  load();
  await choose();
  expect((screen.getByRole('checkbox', { name: '게시' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '내보내기' }));
  expect(api.post).not.toHaveBeenCalled();
  ack();
  fireEvent.click(screen.getByRole('button', { name: '그룹 권한 저장' }));
  await screen.findByText(/그룹 권한을 저장했습니다/);
  expect(api.post).toHaveBeenCalledWith('/enterprise/resources/source/10/group-policies', {
    groupId: 7,
    expectedGroupVersion: 3,
    expectedVersion: 2,
    rights: { read: true, edit: true, publish: false, export: true },
  });
});
it('preserves rights on a version conflict and only reads again explicitly', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<GroupPolicies kind="source" resourceId={10} />);
  open();
  load();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '내보내기' }));
  ack();
  fireEvent.click(screen.getByRole('button', { name: '그룹 권한 저장' }));
  await screen.findByText(/변경 초안을 보존/);
  expect((screen.getByRole('checkbox', { name: '내보내기' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('button', { name: '그룹 권한 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  load();
  await screen.findByRole('option', { name: 'Ops · #7 · 활성' });
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('permits revocation on an inactive group but blocks adding read', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [{ ...group, active: false }], nextAfterId: null }
          : { kind: 'source', resourceId: 10, entries: [policy] },
    }),
  );
  render(<GroupPolicies kind="source" resourceId={10} />);
  open();
  load();
  await screen.findByRole('option', { name: 'Ops · #7 · 비활성' });
  fireEvent.change(screen.getByRole('combobox', { name: '권한 대상 그룹' }), { target: { value: '7' } });
  ack();
  expect((screen.getByRole('button', { name: '그룹 권한 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '읽기' }));
  ack();
  fireEvent.click(screen.getByRole('button', { name: '그룹 권한 저장' }));
  await screen.findByText(/그룹 권한을 저장했습니다/);
  expect(api.post.mock.calls[0][1].rights).toEqual(empty);
});
it('does not attach a late resource response after unmount', async () => {
  let finish!: (value: unknown) => void;
  api.get
    .mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({ data: { kind: 'source', resourceId: 10, entries: [policy] } });
  const view = render(<GroupPolicies kind="source" resourceId={10} />);
  open();
  load();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  view.unmount();
  await act(async () => finish({ data: { entries: [group], nextAfterId: null } }));
  expect(api.post).not.toHaveBeenCalled();
});
