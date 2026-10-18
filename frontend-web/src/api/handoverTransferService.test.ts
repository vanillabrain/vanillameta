import { beforeEach, expect, it, vi } from 'vitest';
import { decideTransfer, fetchTransfer, fetchTransferReview, prepareTransfer } from './handoverTransferService';
import { HandoverProposal } from './handoverService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const proposalId = '12345678-1234-4234-8234-123456789012',
  requestId = '22345678-1234-4234-8234-123456789012';
const s = { organizationId: 7, actorId: 42 };
const p: HandoverProposal = {
  requestId: proposalId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 2,
  status: 'accepted',
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: '2026-10-19T00:00:00Z',
  reviewBasis: 'a'.repeat(64),
  expired: false,
  detailsAvailable: true,
  assets: [{ kind: 'dashboard', id: 11, title: '<b>Private</b>' }],
};
const review = () => ({
  proposalId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  proposalVersion: 2,
  checkedAt: '2026-10-19T00:00:00Z',
  basis: 'opaque-basis',
  eligible: true,
  blockers: [],
  dashboards: [{ id: 11, title: '<b>Private</b>' }],
});
const record = () => ({
  proposalId,
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 1,
  status: 'prepared' as const,
  reviewBasis: 'opaque-review',
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: null,
  completedAt: null,
  detailsAvailable: true,
  dashboards: review().dashboards,
  replayed: false,
});
const input = { requestId, expectedProposalVersion: 2, basis: 'opaque-basis', acknowledgedTransfer: true as const };
beforeEach(() => vi.resetAllMocks());
it('uses exact review/prepare/status paths and preserves the opaque prepare snapshot', async () => {
  api.get.mockResolvedValueOnce({ data: review() });
  expect(await fetchTransferReview(p, s)).toEqual(review());
  expect(api.get).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/transfer-review`, undefined, {});
  api.post.mockResolvedValue({ data: record() });
  await prepareTransfer(p, s, input);
  expect(api.post).toHaveBeenCalledWith(`/enterprise/handover/${proposalId}/transfer`, input);
  api.get.mockResolvedValue({ data: record() });
  await fetchTransfer(p, { ...s, actorId: 43 });
});
it.each([
  { internalHash: 'secret' },
  { organizationId: 8 },
  { ownerId: 99 },
  { proposalVersion: 3 },
  { checkedAt: 'invalid' },
  { eligible: true, blockers: ['running_work'] },
  { blockers: ['unknown'] },
  { dashboards: [{ id: 12, title: 'other' }] },
  { basis: '' },
  { dashboards: [{ id: 11, title: '<b>Private</b>', sql: 'secret' }] },
])('rejects malformed or cross-scope review %j', async change => {
  api.get.mockResolvedValue({ data: { ...review(), ...change } });
  await expect(fetchTransferReview(p, s)).rejects.toThrow();
});
it.each([
  { hash: 'x' },
  { organizationId: 8 },
  { proposalId: requestId },
  { version: 0 },
  { status: 'unknown' },
  { acceptedAt: 'bad' },
  { status: 'accepted', acceptedAt: null },
  { status: 'completed', completedAt: null },
  { detailsAvailable: false },
  { dashboards: [] },
  { dashboards: [{ id: 11, title: 'changed' }] },
  { replayed: 1 },
])('rejects malformed current receipt %j', async change => {
  api.get.mockResolvedValue({ data: { ...record(), ...change } });
  await expect(fetchTransfer(p, s)).rejects.toThrow();
});
it('accepts closed replay receipts without leaking titles or assuming original manifest visibility', async () => {
  const hidden = { ...record(), status: 'cancelled', version: 2, detailsAvailable: false, dashboards: [], replayed: true };
  api.post.mockResolvedValue({ data: hidden });
  expect(await prepareTransfer(p, s, input)).toEqual(hidden);
});
it('captures exact expected version and review basis for recipient accept and source execute', async () => {
  const prepared = record(),
    accepted = { ...prepared, status: 'accepted' as const, version: 2, acceptedAt: '2026-10-19T00:00:00Z' };
  api.post.mockResolvedValueOnce({ data: accepted });
  await decideTransfer(p, { ...s, actorId: 43 }, prepared, 'accept');
  expect(api.post).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/transfer/accept`, {
    expectedVersion: 1,
    reviewBasis: 'opaque-review',
    acknowledgedTransfer: true,
  });
  api.post.mockResolvedValueOnce({
    data: { ...accepted, status: 'completed', version: 3, completedAt: '2026-10-19T01:00:00Z' },
  });
  await decideTransfer(p, s, accepted, 'execute');
  expect(api.post).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/transfer/execute`, {
    expectedVersion: 2,
    reviewBasis: 'opaque-review',
    acknowledgedTransfer: true,
  });
});
it('refuses wrong role, source-included eligibility, expired or unrelated writes before networking', async () => {
  await expect(fetchTransferReview(p, { ...s, actorId: 43 })).rejects.toThrow();
  await expect(decideTransfer(p, s, record(), 'accept')).rejects.toThrow();
  await expect(decideTransfer(p, { ...s, actorId: 43 }, record(), 'cancel')).rejects.toThrow();
  await expect(
    decideTransfer(
      p,
      s,
      { ...record(), status: 'accepted', acceptedAt: '2026-10-19T00:00:00Z', expiresAt: '2000-01-01' },
      'execute',
    ),
  ).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
  api.get.mockResolvedValue({ data: review() });
  await expect(
    fetchTransferReview({ ...p, assets: [...p.assets, { kind: 'source', id: 2, title: 's' }] }, s),
  ).rejects.toThrow();
});
it('propagates definite 409 and unknown 5xx/network/invalid success distinctly', async () => {
  for (const status of [409, 503]) {
    api.post.mockRejectedValueOnce({ response: { status } });
    await expect(prepareTransfer(p, s, input)).rejects.toMatchObject({ status });
  }
  api.post.mockRejectedValueOnce(new Error('network'));
  await expect(prepareTransfer(p, s, input)).rejects.toMatchObject({ status: null });
  api.post.mockResolvedValue({ data: { ok: true } });
  await expect(prepareTransfer(p, s, input)).rejects.toMatchObject({ status: null });
});
it.each([{ detailsAvailable: false, assets: [] }, { expired: true }, { status: 'cancelled' as const }])(
  'rejects disclosed titles after parent disclosure ends %j',
  async change => {
    api.get.mockResolvedValue({ data: record() });
    await expect(fetchTransfer({ ...p, ...change }, s)).rejects.toThrow();
  },
);
it.each([
  { status: 'prepared', version: 2 },
  { status: 'accepted', version: 3, acceptedAt: '2026-10-19T00:00:00Z' },
  { status: 'completed', version: 2, acceptedAt: '2026-10-19T00:00:00Z', completedAt: '2026-10-19T01:00:00Z' },
])('rejects incompatible final status/version %j', async change => {
  api.get.mockResolvedValue({ data: { ...record(), ...change } });
  await expect(fetchTransfer(p, s)).rejects.toThrow();
});
it('closed parent rejects arbitrary disclosed final titles and all new review reads; only hidden empty receipts remain readable', async () => {
  const closed = { ...p, detailsAvailable: false, assets: [] };
  api.get.mockResolvedValueOnce({ data: { ...record(), dashboards: [{ id: 999, title: 'Unrelated private title' }] } });
  await expect(fetchTransfer(closed, s)).rejects.toThrow();
  api.post.mockResolvedValueOnce({ data: { ...record(), dashboards: [{ id: 999, title: 'Unrelated private title' }] } });
  await expect(prepareTransfer(closed, s, input)).rejects.toThrow();
  api.get.mockClear();
  await expect(fetchTransferReview(closed, s)).rejects.toThrow();
  expect(api.get).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ data: { ...record(), detailsAvailable: false, dashboards: [] } });
  await expect(fetchTransfer(closed, s)).resolves.toMatchObject({ detailsAvailable: false, dashboards: [] });
  api.get.mockResolvedValueOnce({
    data: { ...record(), detailsAvailable: false, dashboards: [{ id: 999, title: 'Unrelated private title' }] },
  });
  await expect(fetchTransfer(closed, s)).rejects.toThrow();
});
