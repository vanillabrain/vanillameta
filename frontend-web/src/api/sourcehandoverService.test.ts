import { beforeEach, expect, it, vi } from 'vitest';
import {
  decideSourceTransfer,
  fetchSourceTransfer,
  fetchSourceTransferReview,
  prepareSourceTransfer,
} from './sourcehandoverService';
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
  assets: [{ kind: 'source', id: 11, title: '<b>Private</b>' }],
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
  sources: [{ id: 11, title: '<b>Private</b>', filesChecked: 2, metricCount: 4 }],
});
const record = () => ({
  proposalId,
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 1,
  status: 'prepared' as const,
  reviewBasis: 'r'.repeat(64),
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: null,
  completedAt: null,
  detailsAvailable: true,
  sources: review().sources,
  replayed: false,
});
const input = { requestId, expectedProposalVersion: 2, basis: 'opaque-basis', acknowledgedTransfer: true as const };
beforeEach(() => vi.resetAllMocks());
it('uses exact review/prepare/status paths and preserves the opaque prepare snapshot', async () => {
  api.get.mockResolvedValueOnce({ data: review() });
  expect(await fetchSourceTransferReview(p, s)).toEqual(review());
  expect(api.get).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/source-transfer-review`, undefined, {});
  api.post.mockResolvedValue({ data: record() });
  await prepareSourceTransfer(p, s, input);
  expect(api.post).toHaveBeenCalledWith(`/enterprise/handover/${proposalId}/source-transfer`, input);
  api.get.mockResolvedValue({ data: record() });
  await fetchSourceTransfer(p, { ...s, actorId: 43 });
});
it.each([
  { internalHash: 'secret' },
  { organizationId: 8 },
  { ownerId: 99 },
  { proposalVersion: 3 },
  { checkedAt: 'invalid' },
  { eligible: true, blockers: ['running_work'] },
  { blockers: ['unknown'] },
  { sources: [{ id: 12, title: 'other' }] },
  { basis: '' },
  { sources: [{ id: 11, title: '<b>Private</b>', sql: 'secret' }] },
])('rejects malformed or cross-scope review %j', async change => {
  api.get.mockResolvedValue({ data: { ...review(), ...change } });
  await expect(fetchSourceTransferReview(p, s)).rejects.toThrow();
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
  { sources: [] },
  { sources: [{ id: 11, title: 'changed' }] },
  { replayed: 1 },
])('rejects malformed current receipt %j', async change => {
  api.get.mockResolvedValue({ data: { ...record(), ...change } });
  await expect(fetchSourceTransfer(p, s)).rejects.toThrow();
});
it('accepts closed replay receipts without leaking titles or assuming original manifest visibility', async () => {
  const hidden = { ...record(), status: 'cancelled', version: 2, detailsAvailable: false, sources: [], replayed: true };
  api.post.mockResolvedValue({ data: hidden });
  expect(await prepareSourceTransfer(p, s, input)).toEqual(hidden);
});
it('captures exact expected version and review basis for recipient accept and source execute', async () => {
  const prepared = record(),
    accepted = { ...prepared, status: 'accepted' as const, version: 2, acceptedAt: '2026-10-19T00:00:00Z' };
  api.post.mockResolvedValueOnce({ data: accepted });
  await decideSourceTransfer(p, { ...s, actorId: 43 }, prepared, 'accept');
  expect(api.post).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/source-transfer/accept`, {
    expectedVersion: 1,
    reviewBasis: 'r'.repeat(64),
    acknowledgedTransfer: true,
  });
  api.post.mockResolvedValueOnce({
    data: { ...accepted, status: 'completed', version: 3, completedAt: '2026-10-19T01:00:00Z' },
  });
  await decideSourceTransfer(p, s, accepted, 'execute');
  expect(api.post).toHaveBeenLastCalledWith(`/enterprise/handover/${proposalId}/source-transfer/execute`, {
    expectedVersion: 2,
    reviewBasis: 'r'.repeat(64),
    acknowledgedTransfer: true,
  });
});
it('refuses wrong role, dashboard-mixed eligibility, expired or unrelated writes before networking', async () => {
  await expect(fetchSourceTransferReview(p, { ...s, actorId: 43 })).rejects.toThrow();
  await expect(decideSourceTransfer(p, s, record(), 'accept')).rejects.toThrow();
  await expect(decideSourceTransfer(p, { ...s, actorId: 43 }, record(), 'cancel')).rejects.toThrow();
  await expect(
    decideSourceTransfer(
      p,
      s,
      { ...record(), status: 'accepted', acceptedAt: '2026-10-19T00:00:00Z', expiresAt: '2000-01-01' },
      'execute',
    ),
  ).rejects.toThrow();
  expect(api.post).not.toHaveBeenCalled();
  api.get.mockResolvedValue({ data: review() });
  await expect(
    fetchSourceTransferReview({ ...p, assets: [...p.assets, { kind: 'dashboard', id: 2, title: 'd' }] }, s),
  ).rejects.toThrow();
});
it('propagates definite 409 and unknown 5xx/network/invalid success distinctly', async () => {
  for (const status of [409, 503]) {
    api.post.mockRejectedValueOnce({ response: { status } });
    await expect(prepareSourceTransfer(p, s, input)).rejects.toMatchObject({ status });
  }
  api.post.mockRejectedValueOnce(new Error('network'));
  await expect(prepareSourceTransfer(p, s, input)).rejects.toMatchObject({ status: null });
  api.post.mockResolvedValue({ data: { ok: true } });
  await expect(prepareSourceTransfer(p, s, input)).rejects.toMatchObject({ status: null });
});
it.each([{ detailsAvailable: false, assets: [] }, { expired: true }, { status: 'cancelled' as const }])(
  'rejects disclosed titles after parent disclosure ends %j',
  async change => {
    api.get.mockResolvedValue({ data: record() });
    await expect(fetchSourceTransfer({ ...p, ...change }, s)).rejects.toThrow();
  },
);
it.each([
  { status: 'prepared', version: 2 },
  { status: 'accepted', version: 3, acceptedAt: '2026-10-19T00:00:00Z' },
  { status: 'completed', version: 2, acceptedAt: '2026-10-19T00:00:00Z', completedAt: '2026-10-19T01:00:00Z' },
])('rejects incompatible final status/version %j', async change => {
  api.get.mockResolvedValue({ data: { ...record(), ...change } });
  await expect(fetchSourceTransfer(p, s)).rejects.toThrow();
});
it('closed parent rejects arbitrary disclosed final titles and all new review reads; only hidden empty receipts remain readable', async () => {
  const closed = { ...p, detailsAvailable: false, assets: [] };
  api.get.mockResolvedValueOnce({ data: { ...record(), sources: [{ id: 999, title: 'Unrelated private title' }] } });
  await expect(fetchSourceTransfer(closed, s)).rejects.toThrow();
  api.post.mockResolvedValueOnce({ data: { ...record(), sources: [{ id: 999, title: 'Unrelated private title' }] } });
  await expect(prepareSourceTransfer(closed, s, input)).rejects.toThrow();
  api.get.mockClear();
  await expect(fetchSourceTransferReview(closed, s)).rejects.toThrow();
  expect(api.get).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ data: { ...record(), detailsAvailable: false, sources: [] } });
  await expect(fetchSourceTransfer(closed, s)).resolves.toMatchObject({ detailsAvailable: false, sources: [] });
  api.get.mockResolvedValueOnce({
    data: { ...record(), detailsAvailable: false, sources: [{ id: 999, title: 'Unrelated private title' }] },
  });
  await expect(fetchSourceTransfer(closed, s)).rejects.toThrow();
});
it.each([
  { filesChecked: -1 },
  { filesChecked: 6 },
  { filesChecked: 1.5 },
  { filesChecked: Number.MAX_SAFE_INTEGER + 1 },
  { metricCount: -1 },
  { metricCount: 1.5 },
  { metricCount: Number.MAX_SAFE_INTEGER + 1 },
  { path: '/private.duckdb' },
  { definition: 'SQL' },
  { identity: 'secret' },
])('rejects unsafe or private per-source fields %j', async change => {
  const source = { ...review().sources[0], ...change };
  api.get.mockResolvedValueOnce({ data: { ...review(), sources: [source] } });
  await expect(fetchSourceTransferReview(p, s)).rejects.toThrow();
  api.get.mockResolvedValueOnce({ data: { ...record(), sources: [source] } });
  await expect(fetchSourceTransfer(p, s)).rejects.toThrow();
});
it('permits unresolved zero-file blocked review without representing it as ready; rejects zero-file eligibility or receipts', async () => {
  const source = { ...review().sources[0], filesChecked: 0, metricCount: 0 };
  api.get.mockResolvedValueOnce({
    data: { ...review(), eligible: false, blockers: ['file_unresolved'], sources: [source] },
  });
  await expect(fetchSourceTransferReview(p, s)).resolves.toMatchObject({ eligible: false, blockers: ['file_unresolved'] });
  api.get.mockResolvedValueOnce({ data: { ...review(), sources: [source] } });
  await expect(fetchSourceTransferReview(p, s)).rejects.toThrow();
  api.get.mockResolvedValueOnce({ data: { ...record(), sources: [source] } });
  await expect(fetchSourceTransfer(p, s)).rejects.toThrow();
});
it.each([
  'mixed_assets',
  'unsupported_source',
  'source_in_use',
  'active_permissions',
  'running_work',
  'file_unresolved',
  'file_shared',
  'asset_version_limit',
])('accepts only fixed blocker %s as ineligible', async blocker => {
  api.get.mockResolvedValueOnce({ data: { ...review(), eligible: false, blockers: [blocker] } });
  await expect(fetchSourceTransferReview(p, s)).resolves.toMatchObject({ eligible: false, blockers: [blocker] });
});
it.each([
  { status: 'prepared', version: 1, acceptedAt: '2026-10-19T00:00:00Z' },
  { status: 'cancelled', version: 2, acceptedAt: '2026-10-19T00:00:00Z' },
  { status: 'cancelled', version: 3, acceptedAt: null },
  { status: 'accepted', version: 2, acceptedAt: '2100-01-01' },
  { status: 'completed', version: 3, acceptedAt: '2026-10-19T00:00:00Z', completedAt: '2026-10-18T00:00:00Z' },
  { status: 'completed', version: 3, acceptedAt: '2026-10-19T00:00:00Z', completedAt: '2100-01-01' },
  { reviewBasis: 'too-short' },
])('rejects inconsistent lifecycle times/version/review basis %j', async change => {
  api.get.mockResolvedValueOnce({ data: { ...record(), ...change } });
  await expect(fetchSourceTransfer(p, s)).rejects.toThrow();
});
it('rejects incomplete, duplicate, excessive or dashboard-mixed fixed source manifests', async () => {
  for (const list of [
    [],
    [review().sources[0], review().sources[0]],
    Array.from({ length: 21 }, (_, i) => ({ ...review().sources[0], id: i + 1 })),
  ]) {
    api.get.mockResolvedValueOnce({ data: { ...review(), sources: list } });
    await expect(fetchSourceTransferReview(p, s)).rejects.toThrow();
  }
  api.get.mockResolvedValueOnce({ data: record() });
  await expect(
    fetchSourceTransfer({ ...p, assets: [...p.assets, { kind: 'dashboard', id: 3, title: 'd' }] }, s),
  ).rejects.toThrow();
});
it.each([{ filesChecked: 3 }, { metricCount: 5 }])(
  'rejects changes to the frozen source counts on a successful decision %j',
  async change => {
    api.post.mockResolvedValueOnce({
      data: {
        ...record(),
        status: 'accepted',
        version: 2,
        acceptedAt: '2026-10-19T00:00:00Z',
        sources: [{ ...record().sources[0], ...change }],
      },
    });
    await expect(decideSourceTransfer(p, { ...s, actorId: 43 }, record(), 'accept')).rejects.toThrow();
  },
);
it.each([
  { organizationId: 0 },
  { ownerId: 0 },
  { recipientId: 0 },
  { version: 0 },
  { version: Number.MAX_SAFE_INTEGER + 1 },
])('rejects invalid parent scope before any networking %j', async change => {
  const invalid = { ...p, ...change },
    current = { organizationId: invalid.organizationId, actorId: invalid.ownerId };
  await expect(fetchSourceTransfer(invalid, current)).rejects.toThrow();
  await expect(fetchSourceTransferReview(invalid, current)).rejects.toThrow();
  await expect(prepareSourceTransfer(invalid, current, input)).rejects.toThrow();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
