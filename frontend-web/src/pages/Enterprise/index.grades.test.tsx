import React from 'react';
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Enterprise from './index';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: api.patch, del: api.del }));

const raw = (data: unknown) => ({ data });
const loginId = (n: number) => `synthetic-${n}`;
type Role = 'admin' | 'editor' | 'contributor' | 'viewer' | 'member';

const member = (id: number, role: Role, active = true) => ({
  id,
  userId: loginId(id),
  team: 'growth',
  role,
  active,
});
const adminContext = () => ({
  organization: { id: 7, name: '바닐라메타', version: 3 },
  membership: { userId: 42, role: 'admin', team: 'platform' },
});
const page = (entries: ReturnType<typeof member>[]) => ({
  organizationVersion: 3,
  entries,
  nextAfterId: null,
});
const serveContext = (value: unknown) => api.get.mockResolvedValueOnce(raw(value));
const optionsOf = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map(option => (option as HTMLOptionElement).value);

// The organization page is large; on a busy machine the default one second wait is too short.
configure({ asyncUtilTimeout: 8000 });

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  api.del.mockReset();
});
afterEach(cleanup);

const GRADES = ['admin', 'editor', 'contributor', 'viewer'];

it('offers the four grades, and no legacy member, when adding someone', async () => {
  serveContext(adminContext());
  api.get.mockResolvedValueOnce(raw(page([])));
  render(<Enterprise />);

  const addRole = (await screen.findAllByLabelText(/^역할$/))[0] as HTMLSelectElement;
  expect(optionsOf(addRole)).toEqual(GRADES);
  expect(addRole.value).toBe('editor');
});

it('keeps the legacy member choice only for a member who still holds it', async () => {
  serveContext(adminContext());
  api.get.mockResolvedValueOnce(raw(page([member(4, 'member'), member(5, 'viewer')])));
  render(<Enterprise />);

  fireEvent.click(await screen.findByRole('button', { name: `로그인 ID ${loginId(4)} 변경` }));
  const legacyRow = screen
    .getByRole('button', { name: `로그인 ID ${loginId(4)} 변경`, hidden: true })
    .closest('li') as HTMLElement;
  expect(optionsOf(within(legacyRow).getByLabelText(/^역할$/))).toEqual(['member', ...GRADES]);
  expect((within(legacyRow).getByLabelText(/^역할$/) as HTMLSelectElement).value).toBe('member');
});

it('shows only the four grades when editing a member who already has one', async () => {
  serveContext(adminContext());
  api.get.mockResolvedValueOnce(raw(page([member(5, 'viewer')])));
  render(<Enterprise />);

  fireEvent.click(await screen.findByRole('button', { name: `로그인 ID ${loginId(5)} 변경` }));
  const row = screen
    .getByRole('button', { name: `로그인 ID ${loginId(5)} 변경`, hidden: true })
    .closest('li') as HTMLElement;
  expect(optionsOf(within(row).getByLabelText(/^역할$/))).toEqual(GRADES);
  expect((within(row).getByLabelText(/^역할$/) as HTMLSelectElement).value).toBe('viewer');
});

it.each([
  ['admin', 'admin (관리자)'],
  ['editor', 'editor (편집자)'],
  ['contributor', 'contributor (기여자)'],
  ['viewer', 'viewer (열람자)'],
  ['member', 'member (구성원)'],
] as const)('labels the %s role in the staff list', async (role, label) => {
  serveContext(adminContext());
  api.get.mockResolvedValueOnce(raw(page([member(9, role)])));
  render(<Enterprise />);

  expect(await screen.findByText(`역할 ${label}`)).toBeTruthy();
});

it('shows the grade of the signed-in account', async () => {
  serveContext({ ...adminContext(), membership: { userId: 42, role: 'viewer', team: 'platform' } });
  render(<Enterprise />);

  expect(await screen.findByText('viewer (열람자)')).toBeTruthy();
});

it('keeps the open-mode creation form and wording when the server sends no mode', async () => {
  serveContext({ organization: null, membership: null });
  render(<Enterprise />);

  await screen.findByLabelText(/^새 조직 이름/);
  expect(screen.getByText(/본인이 조직을 만들면 그 조직의 admin이 됩니다/)).toBeTruthy();
});

it('lets the designated administrator create the one organization in the managed mode', async () => {
  serveContext({ organization: null, membership: null, mode: 'managed', canCreateOrganization: true });
  render(<Enterprise />);

  await screen.findByLabelText(/^새 조직 이름/);
  expect(screen.getByText(/지정된 관리자 계정만, 한 번만 만들 수 있습니다/)).toBeTruthy();
  expect(screen.queryByText(/아직 조직에 연결되지 않았습니다/)).toBeNull();
});

it('tells any other account in the managed mode to wait to be added, without a way to create one', async () => {
  serveContext({ organization: null, membership: null, mode: 'managed', canCreateOrganization: false });
  render(<Enterprise />);

  await screen.findByText(/아직 조직에 연결되지 않았습니다/);
  expect(screen.queryByLabelText(/^새 조직 이름/)).toBeNull();
  expect(screen.queryByRole('button', { name: '조직 만들기' })).toBeNull();
  // It can still issue the code an administrator needs to add it.
  expect(screen.getByLabelText(/^참여할 조직 번호/)).toBeTruthy();
});
