import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Groups from './Groups';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const member = (id: number, active = true) => ({ id, userId: `employee-${id}`, role: 'member', team: 'Ops', active });
const group = (version = 2) => ({
  id: 7,
  name: 'Ops',
  active: true,
  version,
  members: [{ id: 2, userId: 'employee-2', current: true, active: true }],
});
const summary = () => ({ id: 7, name: 'Ops', active: true, version: 2 });
const open = () => fireEvent.click(screen.getByRole('button', { name: '그룹 관리 열기' }));
const choose = async () => {
  const button = await screen.findByRole('button', { name: 'Ops · #7 · 활성' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  await screen.findByRole('textbox', { name: '그룹 이름' });
};
const acknowledge = () => fireEvent.click(screen.getByRole('checkbox', { name: /모든 자원 접근/ }));
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [summary()], nextAfterId: null }
          : url === '/enterprise/members'
          ? { organizationVersion: 1, entries: [member(2), member(3)], nextAfterId: null }
          : group(),
    }),
  );
  api.post.mockImplementation((url: string, body: any) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { id: 8, name: body.name, active: true, version: 1, members: [], replayed: false }
          : {
              id: 7,
              name: body.name,
              active: body.active,
              version: body.expectedVersion + 1,
              members: [...body.memberIds].sort((a, b) => a - b).map(id => ({ ...member(id), current: true })),
            },
    }),
  );
});
afterEach(cleanup);
it('reads only after opening, previews roster changes and requires explicit group-wide consent', async () => {
  render(<Groups organizationId={1} />);
  expect(api.get).not.toHaveBeenCalled();
  open();
  await choose();
  fireEvent.click(screen.getByRole('checkbox', { name: '그룹 구성원 3' }));
  expect(screen.getByText(/변경 미리보기: 추가 1명 · 제외 0명/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '그룹 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: '그룹 변경 저장' }));
  await screen.findByText('그룹 구성과 활성 상태를 저장했습니다.');
  expect(api.post).toHaveBeenCalledWith('/enterprise/groups/7', {
    name: 'Ops',
    active: true,
    expectedVersion: 2,
    memberIds: [2, 3],
  });
});
it('preserves a conflicted draft until explicit latest-group reload', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  render(<Groups organizationId={1} />);
  open();
  await choose();
  fireEvent.change(screen.getByRole('textbox', { name: '그룹 이름' }), { target: { value: 'Draft name' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '그룹 구성원 3' }));
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: '그룹 변경 저장' }));
  await screen.findByText(/초안을 유지했습니다/);
  expect((screen.getByRole('textbox', { name: '그룹 이름' }) as HTMLInputElement).value).toBe('Draft name');
  expect((screen.getByRole('checkbox', { name: '그룹 구성원 3' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('button', { name: '그룹 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce({ data: group(4) });
  fireEvent.click(screen.getByRole('button', { name: '현재 그룹 다시 읽기 (초안 초기화)' }));
  await screen.findByText(/현재 버전 4/);
  expect((screen.getByRole('textbox', { name: '그룹 이름' }) as HTMLInputElement).value).toBe('Ops');
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('allows removal of departed members without exposing their old login and blocks new inactive additions', async () => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/enterprise/groups'
          ? { entries: [summary()], nextAfterId: null }
          : url === '/enterprise/members'
          ? { organizationVersion: 1, entries: [member(2), member(3, false)], nextAfterId: null }
          : { ...group(), members: [group().members[0], { id: 9, userId: null, current: false, active: false }] },
    }),
  );
  render(<Groups organizationId={1} />);
  open();
  await choose();
  expect(screen.getByText(/직원 #9 \(소속 확인 필요\)/)).toBeTruthy();
  expect((screen.getByRole('checkbox', { name: '그룹 구성원 3' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '그룹 구성원 9' }));
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: '그룹 변경 저장' }));
  await screen.findByText('그룹 구성과 활성 상태를 저장했습니다.');
  expect(api.post.mock.calls[0][1].memberIds).toEqual([2]);
});
it('creates a group explicitly and preserves its name on an uncertain/duplicate creation error', async () => {
  api.post.mockRejectedValueOnce(new Error('lost'));
  render(<Groups organizationId={1} />);
  open();
  await screen.findByRole('button', { name: 'Ops · #7 · 활성' });
  fireEvent.change(screen.getByRole('textbox', { name: '새 그룹 이름' }), { target: { value: 'New group' } });
  fireEvent.click(screen.getByRole('button', { name: '그룹 만들기' }));
  await screen.findByText(/초안을 유지했습니다/);
  expect((screen.getByRole('textbox', { name: '새 그룹 이름' }) as HTMLInputElement).value).toBe('New group');
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('drops late detail answers after close and reopens with the current group', async () => {
  let finish!: (value: unknown) => void,
    reads = 0;
  const get = api.get.getMockImplementation();
  api.get.mockImplementation((url: string, ...args: any[]) => {
    if (url === '/enterprise/groups/7') {
      reads += 1;
      return reads === 1
        ? new Promise(resolve => {
            finish = resolve;
          })
        : Promise.resolve({ data: { ...group(4), name: 'Fresh' } });
    }
    return get(url, ...args);
  });
  render(<Groups organizationId={1} />);
  open();
  const button = await screen.findByRole('button', { name: 'Ops · #7 · 활성' });
  fireEvent.click(button);
  await waitFor(() => expect(reads).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '그룹 관리 접기' }));
  open();
  await choose();
  await screen.findByDisplayValue('Fresh');
  await act(async () => finish({ data: group() }));
  expect(screen.queryByDisplayValue('Ops')).toBeNull();
});
it('handles StrictMode loading and never writes an unchanged group', async () => {
  render(
    <React.StrictMode>
      <Groups organizationId={1} />
    </React.StrictMode>,
  );
  open();
  await choose();
  acknowledge();
  expect((screen.getByRole('button', { name: '그룹 변경 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});
it('keeps the exact creation request after response loss and resolves the original renamed group', async () => {
  api.post
    .mockRejectedValueOnce(new Error('lost'))
    .mockResolvedValueOnce({ data: { ...group(4), name: 'Renamed after creation', replayed: true } });
  render(<Groups organizationId={1} />);
  open();
  await screen.findByRole('button', { name: 'Ops · #7 · 활성' });
  fireEvent.change(screen.getByRole('textbox', { name: '새 그룹 이름' }), { target: { value: 'Original name' } });
  fireEvent.click(screen.getByRole('button', { name: '그룹 만들기' }));
  await screen.findByText(/미확정 생성 요청을 보존/);
  const first = structuredClone(api.post.mock.calls[0][1]);
  expect(typeof first.requestId).toBe('string');
  expect((screen.getByRole('textbox', { name: '새 그룹 이름' }) as HTMLInputElement).disabled).toBe(true);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '같은 그룹 생성 요청 확인' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '같은 그룹 생성 요청 확인' }));
  await screen.findByText(/이전 생성 요청의 그룹을 확인/);
  expect(api.post.mock.calls[1][1]).toEqual(first);
  expect((screen.getByRole('textbox', { name: '그룹 이름' }) as HTMLInputElement).value).toBe('Renamed after creation');
});
