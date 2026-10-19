import { beforeEach, expect, it, vi } from 'vitest';
import { HandoverProposal } from './handoverService';
import { fetchHandoverDependencyReview } from './handoverReviewService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const requestId = '12345678-1234-4234-8234-123456789012';
const scope = { organizationId: 7, actorId: 42 };
const review = (): HandoverProposal => ({
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 2,
  status: 'accepted',
  expiresAt: '2026-10-20T12:00:00Z',
  acceptedAt: '2026-10-19T10:00:00Z',
  reviewBasis: 'a'.repeat(64),
  assets: [
    { kind: 'source', id: 11, title: 'Source' },
    { kind: 'dashboard', id: 21, title: 'Dashboard' },
  ],
  expired: false,
  detailsAvailable: true,
});
const report = () => ({
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  proposalVersion: 2,
  checkedAt: '2026-10-19T11:00:00Z',
  scope: 'selected_dependencies_v1',
  executionAvailable: false,
  assets: review().assets.map((asset, i) => ({
    ...asset,
    dependencyStatus: i ? 'missing' : 'covered',
    requiredSources: i ? 2 : 1,
    selectedSources: 1,
    missingOwnedSources: i ? 1 : 0,
    otherSources: 0,
    metricCount: i ? 0 : 3,
    storage: i ? 'not_applicable' : 'file_review_required',
  })),
});
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: report() });
});
it('GETs only selected dependencies with supplied abort config and zero mutations', async () => {
  const config = { signal: new AbortController().signal };
  await expect(fetchHandoverDependencyReview(review(), scope, config)).resolves.toEqual(report());
  expect(api.get).toHaveBeenCalledExactlyOnceWith(`/enterprise/handover/${requestId}/dependencies`, undefined, config);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it.each([
  { requestId: '22345678-1234-4234-8234-123456789012' },
  { organizationId: 8 },
  { ownerId: 43 },
  { recipientId: 44 },
  { proposalVersion: 3 },
  { proposalVersion: '2' },
  { checkedAt: 'invalid' },
  { checkedAt: 1792400000000 },
  { scope: 'all_dependencies' },
  { executionAvailable: true },
  { executionAvailable: 'false' },
  { fingerprint: 'hidden' },
  { assets: [] },
])('rejects changed scope/contract %j', async change => {
  api.get.mockResolvedValue({ data: { ...report(), ...change } });
  await expect(fetchHandoverDependencyReview(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each(['requiredSources', 'selectedSources', 'missingOwnedSources', 'otherSources', 'metricCount'])(
  'requires safe nonnegative %s and no internal metadata',
  async key => {
    for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', NaN, null, undefined]) {
      const data: any = report();
      data.assets[0][key] = value;
      api.get.mockResolvedValue({ data });
      await expect(fetchHandoverDependencyReview(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
    }
  },
);
it('requires exact selected asset order/identity/title, enums, complete fields and no hidden fields', async () => {
  const base = report();
  const missing: any = { ...base.assets[0] };
  delete missing.storage;
  for (const assets of [
    [...base.assets].reverse(),
    [base.assets[0], base.assets[0]],
    [{ ...base.assets[0], id: 99 }, base.assets[1]],
    [{ ...base.assets[0], title: 'Other' }, base.assets[1]],
    [{ ...base.assets[0], path: 'private' }, base.assets[1]],
    [{ ...base.assets[0], storage: 'ready' }, base.assets[1]],
    [{ ...base.assets[0], dependencyStatus: 'ready' }, base.assets[1]],
    [missing, base.assets[1]],
  ]) {
    api.get.mockResolvedValue({ data: { ...base, assets } });
    await expect(fetchHandoverDependencyReview(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it('blocks non-owner, foreign, inactive disclosure, expired and unaccepted requests before GET', async () => {
  for (const changed of [
    { status: 'pending' },
    { status: 'cancelled' },
    { expired: true },
    { detailsAvailable: false },
    { version: 0 },
    { assets: [] },
  ])
    await expect(
      fetchHandoverDependencyReview({ ...review(), ...changed } as HandoverProposal, scope),
    ).rejects.toMatchObject({ kind: 'invalid' });
  await expect(fetchHandoverDependencyReview(review(), { ...scope, actorId: 43 })).rejects.toMatchObject({
    kind: 'invalid',
  });
  await expect(fetchHandoverDependencyReview(review(), { ...scope, organizationId: 8 })).rejects.toMatchObject({
    kind: 'invalid',
  });
  expect(api.get).not.toHaveBeenCalled();
});
it.each([
  [401, 'auth'],
  [403, 'forbidden'],
  [404, 'invalid'],
  [409, 'conflict'],
  [503, 'invalid'],
  [undefined, 'network'],
])('maps %s through enterpriseError without writes', async (status, kind) => {
  api.get.mockRejectedValue(status ? { response: { status } } : new Error('offline'));
  await expect(fetchHandoverDependencyReview(review(), scope)).rejects.toMatchObject({ kind });
  expect(api.post).not.toHaveBeenCalled();
});
