import { beforeEach, expect, it, vi } from 'vitest';
import {
  createHandoverProposal,
  fetchHandoverCandidates,
  fetchHandoverProposal,
  writeHandoverDecision,
} from './handoverService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const requestId = '12345678-1234-4234-8234-123456789012';
const basis = 'a'.repeat(64);
const scope = { organizationId: 7, actorId: 42 };
const asset = { kind: 'source' as const, id: 11, title: '<b>Literal title</b>' };
const input = { requestId, recipientId: 43, assets: [asset] };
const proposal = () => ({
  requestId,
  organizationId: 7,
  ownerId: 42,
  recipientId: 43,
  version: 1,
  status: 'pending' as const,
  expiresAt: '2026-10-20T12:00:00Z',
  acceptedAt: null,
  reviewBasis: basis,
  assets: [asset],
  expired: false,
  detailsAvailable: true,
});
beforeEach(() => vi.resetAllMocks());
it('validates candidate kind/cursor and exact metadata-only page', async () => {
  api.get.mockResolvedValue({ data: { entries: [asset], nextAfterId: 11 } });
  const config = { signal: new AbortController().signal };
  await expect(fetchHandoverCandidates('source', 10, config)).resolves.toMatchObject({ entries: [asset] });
  expect(api.get).toHaveBeenCalledWith('/enterprise/handover/candidates', { kind: 'source', afterId: 10 }, config);
  for (const page of [
    { entries: [{ ...asset, kind: 'dashboard' }], nextAfterId: null },
    { entries: [asset, asset], nextAfterId: null },
    { entries: [asset], nextAfterId: 12 },
    { entries: [{ ...asset, fingerprint: 'private' }], nextAfterId: null },
    { entries: [{ ...asset, title: 'x'.repeat(301) }], nextAfterId: null },
    { entries: Array.from({ length: 21 }, (_, i) => ({ ...asset, id: i + 1 })), nextAfterId: null },
    { assets: [asset], nextAfterId: null },
  ]) {
    api.get.mockResolvedValue({ data: page });
    await expect(fetchHandoverCandidates('source')).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it.each([
  { organizationId: 8 },
  { ownerId: 99 },
  { requestId: 'invalid' },
  { version: 1.5 },
  { expiresAt: 'never' },
  { reviewBasis: 'A'.repeat(64) },
  { payloadHash: basis },
  { expired: 'false' },
  { assets: [{ ...asset, fingerprint: basis }] },
  { assets: [] },
  { acceptedAt: 'invalid' },
  { status: 'accepted', acceptedAt: null },
])('rejects malformed or foreign proposal %j', async change => {
  api.get.mockResolvedValue({ data: { ...proposal(), ...change } });
  await expect(fetchHandoverProposal(requestId, scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it('posts the frozen client UUID and asset ids, and accepts identical replay receipts without extra writes', async () => {
  api.post.mockResolvedValue({ data: proposal() });
  await expect(createHandoverProposal(input, scope)).resolves.toEqual(proposal());
  await expect(createHandoverProposal(input, scope)).resolves.toEqual(proposal());
  expect(api.post.mock.calls).toEqual([
    ['/enterprise/handover', input],
    ['/enterprise/handover', input],
  ]);
  api.post.mockClear();
  for (const body of [
    { ...input, recipientId: 42 },
    { ...input, assets: [] },
    { ...input, assets: [...input.assets, ...input.assets] },
    { ...input, assets: [{ kind: asset.kind, id: asset.id }] },
  ])
    await expect(createHandoverProposal(body as any, scope)).rejects.toMatchObject({ kind: 'invalid' });
  expect(api.post).not.toHaveBeenCalled();
});
it('uses only the reviewed CAS version and basis, and enforces participant roles', async () => {
  const accepted = { ...proposal(), status: 'accepted', acceptedAt: '2026-10-19T12:00:00Z', version: 2 };
  api.post.mockResolvedValue({ data: accepted });
  await expect(writeHandoverDecision(proposal(), 'accept', { ...scope, actorId: 43 })).resolves.toEqual(accepted);
  expect(api.post).toHaveBeenLastCalledWith(`/enterprise/handover/${requestId}/accept`, {
    expectedVersion: 1,
    reviewBasis: basis,
  });
  api.post.mockClear();
  await expect(writeHandoverDecision(proposal(), 'accept', scope)).rejects.toMatchObject({ kind: 'invalid' });
  await expect(writeHandoverDecision(proposal(), 'cancel', { ...scope, actorId: 43 })).rejects.toMatchObject({
    kind: 'invalid',
  });
  await expect(
    writeHandoverDecision({ ...proposal(), expired: true }, 'accept', { ...scope, actorId: 43 }),
  ).rejects.toMatchObject({ kind: 'invalid' });
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValue({
    data: { ...accepted, status: 'cancelled', version: 3, detailsAvailable: false, assets: [] },
  });
  await expect(writeHandoverDecision(accepted as any, 'cancel', scope)).resolves.toMatchObject({ version: 3 });
});
it('rejects changed write receipts and normalizes network/permission/conflict failures', async () => {
  api.post.mockResolvedValue({ data: { ...proposal(), recipientId: 99 } });
  await expect(createHandoverProposal(input, scope)).rejects.toMatchObject({ kind: 'invalid' });
  for (const [status, kind] of [
    [403, 'forbidden'],
    [409, 'conflict'],
    [undefined, 'network'],
  ]) {
    api.get.mockRejectedValue(status ? { response: { status } } : new Error('offline'));
    await expect(fetchHandoverProposal(requestId, scope)).rejects.toMatchObject({ kind });
  }
});
it('binds exact confirmed titles and accepts current hidden status receipts on identical create replay', async () => {
  api.post.mockResolvedValue({ data: { ...proposal(), assets: [{ ...asset, title: 'renamed' }] } });
  await expect(createHandoverProposal(input, scope)).rejects.toMatchObject({ kind: 'invalid' });
  const cancelled = { ...proposal(), status: 'cancelled', version: 3, detailsAvailable: false, assets: [] };
  api.post.mockResolvedValue({ data: cancelled });
  await expect(createHandoverProposal(input, scope)).resolves.toEqual(cancelled);
  expect(api.post).toHaveBeenLastCalledWith('/enterprise/handover', input);
  for (const data of [
    { ...cancelled, assets: [asset] },
    { ...proposal(), assets: [] },
    { ...proposal(), detailsAvailable: undefined },
  ]) {
    api.get.mockResolvedValue({ data });
    await expect(fetchHandoverProposal(requestId, scope)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it('returns current cancelled or expired status for historical acceptance replay rather than assuming reactivation', async () => {
  const cancelled = {
    ...proposal(),
    status: 'cancelled',
    version: 3,
    detailsAvailable: false,
    assets: [],
    acceptedAt: '2026-10-19T12:00:00Z',
  };
  api.post.mockResolvedValue({ data: cancelled });
  await expect(writeHandoverDecision(proposal(), 'accept', { ...scope, actorId: 43 })).resolves.toEqual(cancelled);
  const expired = { ...cancelled, status: 'accepted', expired: true };
  api.post.mockResolvedValue({ data: expired });
  await expect(writeHandoverDecision(proposal(), 'accept', { ...scope, actorId: 43 })).resolves.toEqual(expired);
});
