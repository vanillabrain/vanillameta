import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTERPRISE_ROLES, EnterpriseApiError, fetchContext, fetchMembers, isEnterpriseRole } from './enterpriseService';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: api.patch, del: api.del }));

const organization = { id: 7, name: '바닐라메타', version: 3 };
const context = (role: unknown, extra: Record<string, unknown> = {}) => ({
  data: { organization, membership: { userId: 42, role, team: 'platform' }, ...extra },
});
const page = (role: unknown) => ({
  data: {
    organizationVersion: 3,
    entries: [{ id: 1, userId: 'synthetic-1', team: 'growth', role, active: true }],
    nextAfterId: null,
  },
});

beforeEach(() => api.get.mockReset());

describe('organization roles', () => {
  it('knows the four grades and the legacy member, and nothing else', () => {
    expect([...ENTERPRISE_ROLES]).toEqual(['admin', 'editor', 'contributor', 'viewer']);
    for (const role of ['admin', 'editor', 'contributor', 'viewer', 'member']) expect(isEnterpriseRole(role)).toBe(true);
    for (const role of ['owner', 'ADMIN', '', null, undefined, 1]) expect(isEnterpriseRole(role)).toBe(false);
  });

  it.each(['admin', 'editor', 'contributor', 'viewer', 'member'])('reads a membership with the %s role', async role => {
    api.get.mockResolvedValue(context(role));
    await expect(fetchContext()).resolves.toMatchObject({ membership: { role } });
  });

  it('refuses an unknown membership role instead of rendering a partial organization', async () => {
    api.get.mockResolvedValue(context('owner'));
    await expect(fetchContext()).rejects.toBeInstanceOf(EnterpriseApiError);
  });

  it.each(['admin', 'editor', 'contributor', 'viewer', 'member'])('reads a listed member with the %s role', async role => {
    api.get.mockResolvedValue(page(role));
    await expect(fetchMembers()).resolves.toMatchObject({ entries: [{ role }] });
  });

  it('refuses a listed member whose role is unknown', async () => {
    api.get.mockResolvedValue(page('owner'));
    await expect(fetchMembers()).rejects.toBeInstanceOf(EnterpriseApiError);
  });
});

describe('organization mode', () => {
  it('reads a context from an older server that sends neither field', async () => {
    api.get.mockResolvedValue(context('admin'));
    const result = await fetchContext();
    expect(result.mode).toBeUndefined();
    expect(result.canCreateOrganization).toBeUndefined();
  });

  it('reads the managed mode and whether this account may create the organization', async () => {
    api.get.mockResolvedValue({
      data: { organization: null, membership: null, mode: 'managed', canCreateOrganization: true },
    });
    await expect(fetchContext()).resolves.toMatchObject({ mode: 'managed', canCreateOrganization: true });
  });

  it.each([
    ['an unknown mode', { mode: 'closed' }],
    ['a non-boolean canCreateOrganization', { canCreateOrganization: 'yes' }],
  ])('refuses %s', async (_name, extra) => {
    api.get.mockResolvedValue({ data: { organization: null, membership: null, ...extra } });
    await expect(fetchContext()).rejects.toBeInstanceOf(EnterpriseApiError);
  });
});
