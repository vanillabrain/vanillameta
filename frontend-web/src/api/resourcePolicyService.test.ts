import { beforeEach, expect, it, vi } from 'vitest';
import { EnterpriseApiError } from '@/api/enterpriseService';
import {
  fetchResourcePolicies,
  fetchResourcePolicyResources,
  isResourceCursor,
  resourcePolicyError,
  saveResourcePolicy,
} from './resourcePolicyService';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: vi.fn(), del: vi.fn() }));

const raw = (data: unknown) => ({ data });
const rights = (read: boolean, edit = false, publish = false, exportRight = false) => ({
  read,
  edit,
  publish,
  export: exportRight,
});
const failureOf = async (promise: Promise<unknown>) => (await promise.catch(error => error)) as EnterpriseApiError;

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue(raw({ entries: [], nextAfter: null }));
  api.post.mockResolvedValue(raw({}));
});

it('accepts only kind:id cursors', () => {
  expect(isResourceCursor('dashboard:12')).toBe(true);
  expect(isResourceCursor('source:5')).toBe(true);
  expect(isResourceCursor('source:0')).toBe(false);
  expect(isResourceCursor('folder:1')).toBe(false);
  expect(isResourceCursor('12')).toBe(false);
  expect(isResourceCursor(null)).toBe(false);
});

it('sends the cursor only when one was returned and rejects an unknown resource payload', async () => {
  api.get.mockResolvedValueOnce(
    raw({ entries: [{ kind: 'dashboard', id: 12, label: '매출 대시보드' }], nextAfter: 'source:5' }),
  );
  await expect(fetchResourcePolicyResources()).resolves.toEqual({
    entries: [{ kind: 'dashboard', id: 12, label: '매출 대시보드' }],
    nextAfter: 'source:5',
  });
  expect(api.get).toHaveBeenCalledWith('/enterprise/resources', {}, {});

  await fetchResourcePolicyResources('source:5');
  expect(api.get).toHaveBeenLastCalledWith('/enterprise/resources', { after: 'source:5' }, {});

  api.get.mockResolvedValueOnce(raw({ entries: [{ kind: 'folder', id: 1, label: 'x' }], nextAfter: null }));
  expect((await failureOf(fetchResourcePolicyResources())).kind).toBe('invalid');
});

it('binds a grants read and a saved grant to the exact resource and recipient asked for', async () => {
  api.get.mockResolvedValueOnce(
    raw({
      kind: 'dashboard',
      resourceId: 12,
      entries: [{ recipientId: 9, userId: 'synthetic-9', version: 2, rights: rights(true) }],
    }),
  );
  await expect(fetchResourcePolicies('dashboard', 12)).resolves.toMatchObject({ resourceId: 12 });
  expect(api.get).toHaveBeenCalledWith('/enterprise/resources/dashboard/12/policies', undefined, {});

  // An answer for another resource is never applied as this resource's grants.
  api.get.mockResolvedValueOnce(raw({ kind: 'dashboard', resourceId: 13, entries: [] }));
  expect((await failureOf(fetchResourcePolicies('dashboard', 12))).kind).toBe('invalid');

  api.post.mockResolvedValueOnce(
    raw({ kind: 'dashboard', resourceId: 12, recipientId: 9, version: 3, rights: rights(true, true) }),
  );
  await expect(
    saveResourcePolicy('dashboard', 12, { recipientId: 9, expectedVersion: 2, rights: rights(true, true) }),
  ).resolves.toMatchObject({ version: 3, recipientId: 9 });
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe('/enterprise/resources/dashboard/12/policies');
  // The body carries exactly the three documented keys; the actor and owner stay server-side.
  expect(Object.keys(body).sort()).toEqual(['expectedVersion', 'recipientId', 'rights']);
  expect(Object.keys(body.rights).sort()).toEqual(['edit', 'export', 'publish', 'read']);
  expect(body).toEqual({
    recipientId: 9,
    expectedVersion: 2,
    rights: { read: true, edit: true, publish: false, export: false },
  });

  // A receipt for another recipient is not a saved grant for this one.
  api.post.mockResolvedValueOnce(
    raw({ kind: 'dashboard', resourceId: 12, recipientId: 11, version: 3, rights: rights(true) }),
  );
  const mismatch = await failureOf(
    saveResourcePolicy('dashboard', 12, { recipientId: 9, expectedVersion: 2, rights: rights(true) }),
  );
  expect(mismatch.kind).toBe('invalid');
});

it('maps refusals onto the shared policy error kinds', () => {
  expect(resourcePolicyError({ response: { status: 403 } }).kind).toBe('forbidden');
  expect(resourcePolicyError({ response: { status: 401 } }).kind).toBe('auth');
  expect(resourcePolicyError({ response: { status: 409 } }).message).toMatch(/최신 정책을 다시 불러온 뒤/);
  expect(resourcePolicyError(new Error('Network Error')).kind).toBe('network');
  expect(resourcePolicyError({ response: { status: 400, data: { message: 'recipient inactive' } } }).message).toBe(
    'recipient inactive',
  );

  // A payload that failed the shape check is already classified and passes through unchanged.
  const invalid = new EnterpriseApiError('bad shape', 'invalid');
  expect(resourcePolicyError(invalid)).toBe(invalid);
});

it('keeps a valid 300-character source name discoverable for inactive-source recovery', async () => {
  const label = 'x'.repeat(300);
  api.get.mockResolvedValueOnce(raw({ entries: [{ kind: 'source', id: 3, label }], nextAfter: null }));
  expect((await fetchResourcePolicyResources()).entries[0].label).toBe(label);
  api.get.mockResolvedValueOnce(raw({ entries: [{ kind: 'source', id: 3, label: label + 'x' }], nextAfter: null }));
  expect(await failureOf(fetchResourcePolicyResources())).toBeInstanceOf(EnterpriseApiError);
});
