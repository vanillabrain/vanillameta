import { beforeEach, expect, it, vi } from 'vitest';
import { HandoverProposal } from './handoverService';
import { fetchHandoverFileCustody } from './handoverCustodyService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const uuid = '12345678-1234-4234-8234-123456789012';
const scope = { organizationId: 7, actorId: 42 };
const review = (): HandoverProposal => ({
  requestId: uuid,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 2,
  status: 'accepted',
  expiresAt: '2026-10-20T12:00:00Z',
  acceptedAt: '2026-10-19T10:00:00Z',
  reviewBasis: 'a'.repeat(64),
  assets: [
    { kind: 'source', id: 11, title: 'File source' },
    { kind: 'dashboard', id: 21, title: 'Dashboard' },
    { kind: 'source', id: 12, title: 'Connection' },
  ],
  expired: false,
  detailsAvailable: true,
});
const report = () => ({
  requestId: uuid,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  proposalVersion: 2,
  checkedAt: '2026-10-19T11:00:00Z',
  scope: 'selected_file_custody_v1',
  executionAvailable: false,
  sources: [
    {
      kind: 'source',
      id: 11,
      title: 'File source',
      storage: 'managed_file',
      identity: 'observed',
      filesChecked: 2,
      consumers: 'none_observed',
      refresh: 'none_observed',
    },
    {
      kind: 'source',
      id: 12,
      title: 'Connection',
      storage: 'external_connection',
      identity: 'not_applicable',
      filesChecked: 0,
      consumers: 'not_applicable',
      refresh: 'not_applicable',
    },
  ],
});
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: report() });
});
it('GETs only custody with the explicit abort config; validates filtered source order and no writes', async () => {
  const config = { signal: new AbortController().signal };
  await expect(fetchHandoverFileCustody(review(), scope, config)).resolves.toEqual(report());
  expect(api.get).toHaveBeenCalledExactlyOnceWith(`/enterprise/handover/${uuid}/custody`, undefined, config);
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
  { scope: 'all_files' },
  { executionAvailable: true },
  { identityHash: 'private' },
  { sources: [] },
])('refuses changed scope/version or malformed root %j', async change => {
  api.get.mockResolvedValue({ data: { ...report(), ...change } });
  await expect(fetchHandoverFileCustody(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each([
  { kind: 'dashboard' },
  { id: 99 },
  { id: '11' },
  { title: 'Renamed' },
  { storage: 'ready' },
  { identity: 'verified' },
  { consumers: 'exclusive' },
  { refresh: 'idle' },
  { filesChecked: -1 },
  { filesChecked: 6 },
  { filesChecked: 0.5 },
  { filesChecked: '1' },
  { filesChecked: NaN },
  { filesChecked: Number.MAX_SAFE_INTEGER + 1 },
  { path: 'private' },
  { inode: 3 },
  { manifest: {} },
])('refuses malformed or secret source fields %j', async change => {
  const data = report();
  data.sources[0] = { ...data.sources[0], ...change } as any;
  api.get.mockResolvedValue({ data });
  await expect(fetchHandoverFileCustody(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it('rejects missing fields, duplicated/unselected/out-of-order sources and invalid external-file assertions', async () => {
  const base = report();
  const missing: any = { ...base.sources[0] };
  delete missing.identity;
  for (const sources of [
    [missing, base.sources[1]],
    [...base.sources].reverse(),
    [base.sources[0], base.sources[0]],
    [base.sources[0]],
    [base.sources[0], { ...base.sources[1], filesChecked: 1 }],
    [base.sources[0], { ...base.sources[1], identity: 'observed' }],
  ]) {
    api.get.mockResolvedValue({ data: { ...base, sources } });
    await expect(fetchHandoverFileCustody(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it('accepts only an empty source list for a dashboard-only manifest and preserves unresolved observations', async () => {
  api.get.mockResolvedValue({ data: { ...report(), sources: [] } });
  await expect(fetchHandoverFileCustody({ ...review(), assets: [review().assets[1]] }, scope)).resolves.toMatchObject({
    sources: [],
  });
  api.get.mockResolvedValue({ data: report() });
  await expect(fetchHandoverFileCustody({ ...review(), assets: [review().assets[1]] }, scope)).rejects.toMatchObject({
    kind: 'invalid',
  });
  const data = report();
  data.sources[0] = {
    ...data.sources[0],
    storage: 'unresolved',
    identity: 'unresolved',
    consumers: 'unresolved',
    refresh: 'active_or_unresolved',
    filesChecked: 0,
  };
  api.get.mockResolvedValue({ data });
  await expect(fetchHandoverFileCustody(review(), scope)).resolves.toMatchObject({ sources: [{ filesChecked: 0 }, {}] });
});
it('refuses recipient, foreign or ineligible proposal inputs without a network read', async () => {
  for (const change of [
    { status: 'pending' },
    { status: 'cancelled' },
    { expired: true },
    { detailsAvailable: false },
    { assets: [] },
    { version: 0 },
  ])
    await expect(fetchHandoverFileCustody({ ...review(), ...change } as HandoverProposal, scope)).rejects.toMatchObject({
      kind: 'invalid',
    });
  await expect(fetchHandoverFileCustody(review(), { ...scope, actorId: 43 })).rejects.toMatchObject({ kind: 'invalid' });
  await expect(fetchHandoverFileCustody(review(), { ...scope, organizationId: 8 })).rejects.toMatchObject({
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
])('normalizes %s errors without returning success observations', async (status, kind) => {
  api.get.mockRejectedValue(status ? { response: { status } } : new Error('offline'));
  await expect(fetchHandoverFileCustody(review(), scope)).rejects.toMatchObject({ kind });
});
it.each([
  { storage: 'managed_file', identity: 'not_applicable' },
  { storage: 'managed_file', consumers: 'not_applicable' },
  { storage: 'managed_file', refresh: 'not_applicable' },
  { storage: 'managed_file', identity: 'observed', filesChecked: 0 },
  ...[
    { identity: 'observed' },
    { identity: 'unresolved' },
    { consumers: 'present' },
    { consumers: 'none_observed' },
    { consumers: 'unresolved' },
    { refresh: 'none_observed' },
    { refresh: 'active_or_unresolved' },
    { filesChecked: 1 },
  ].map(change => ({
    storage: 'external_connection',
    identity: 'not_applicable',
    consumers: 'not_applicable',
    refresh: 'not_applicable',
    filesChecked: 0,
    ...change,
  })),
  ...[
    { identity: 'observed' },
    { identity: 'not_applicable' },
    { consumers: 'present' },
    { consumers: 'none_observed' },
    { consumers: 'not_applicable' },
    { refresh: 'none_observed' },
    { refresh: 'not_applicable' },
    { filesChecked: 1 },
  ].map(change => ({
    storage: 'unresolved',
    identity: 'unresolved',
    consumers: 'unresolved',
    refresh: 'active_or_unresolved',
    filesChecked: 0,
    ...change,
  })),
])('rejects individually valid fields with contradictory storage observations %j', async change => {
  const data = report();
  data.sources[0] = { ...data.sources[0], ...change } as any;
  api.get.mockResolvedValue({ data });
  await expect(fetchHandoverFileCustody(review(), scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each([0, 5])('preserves incomplete managed-file observations with %s checked files', async filesChecked => {
  const data = report();
  data.sources[0] = {
    ...data.sources[0],
    identity: 'unresolved',
    consumers: 'unresolved',
    refresh: 'active_or_unresolved',
    filesChecked,
  };
  api.get.mockResolvedValue({ data });
  await expect(fetchHandoverFileCustody(review(), scope)).resolves.toMatchObject({
    sources: [{ storage: 'managed_file', identity: 'unresolved', filesChecked }, {}],
  });
});
