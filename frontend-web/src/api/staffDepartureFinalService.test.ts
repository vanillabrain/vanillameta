import { beforeEach, expect, it, vi } from 'vitest';
import {
  cancelStaffDeparture,
  completeStaffDeparture,
  fetchStaffDeparture,
  requestStaffDeparture,
  reviewStaffDeparture,
  STAFF_DEPARTURE_COUNTS,
} from './staffDepartureService';
import {
  completedDeparture,
  departureId as id,
  departureRecord,
  departureReview,
  departureScope as scope,
} from './staffDepartureFixtures.test-support';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const admin = { ...scope, actorId: 4, isAdmin: true };
const input = { requestId: id, expectedOrganizationVersion: 4, acknowledgedDeparture: true as const };
beforeEach(() => vi.resetAllMocks());
it('creates self with exact acknowledged input and returns historical completed replay', async () => {
  api.post.mockResolvedValue({ data: completedDeparture() });
  await expect(requestStaffDeparture(input, scope)).resolves.toMatchObject({ status: 'completed' });
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/enterprise/staff-departure', input);
});
it('allows own old-org receipt without membership or after joining another org; blocks others', async () => {
  api.get.mockResolvedValue({ data: completedDeparture() });
  await expect(
    fetchStaffDeparture(id, { ...scope, organizationId: null, organizationVersion: null }),
  ).resolves.toMatchObject({ userId: 3 });
  await expect(fetchStaffDeparture(id, { ...scope, organizationId: 8 })).resolves.toBeTruthy();
  for (const s of [
    { ...scope, actorId: 5 },
    { ...admin, organizationId: 8 },
    { ...admin, organizationId: null, organizationVersion: null, isAdmin: false },
  ])
    await expect(fetchStaffDeparture(id, s)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each(['privateTitle', 'authVersion', 'payloadHash', 'newOrganizationId'])(
  'rejects unknown record field %s',
  async field => {
    api.get.mockResolvedValue({ data: { ...departureRecord(), [field]: 'private' } });
    await expect(fetchStaffDeparture(id, scope)).rejects.toMatchObject({ kind: 'invalid' });
  },
);
it.each([
  { version: 2 },
  { userId: '3' },
  { organizationId: 0 },
  { expiresAt: 'bad' },
  { completedAt: new Date().toISOString() },
  { status: 'unknown' },
  { replayed: 1 },
])('rejects malformed/cross-field record %s', async patch => {
  api.get.mockResolvedValue({ data: { ...departureRecord(), ...patch } });
  await expect(fetchStaffDeparture(id, scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it('reads exact review for another admin and captures the reviewed basis in completion', async () => {
  const record = departureRecord(),
    review = departureReview(),
    signal = new AbortController().signal;
  api.get.mockResolvedValue({ data: review });
  api.post.mockResolvedValue({ data: completedDeparture() });
  await expect(reviewStaffDeparture(record, admin, { signal })).resolves.toEqual(review);
  const body = { expectedVersion: 1, reviewBasis: review.basis, acknowledgedDeparture: true as const };
  await completeStaffDeparture(record, body, admin);
  expect(api.get).toHaveBeenCalledExactlyOnceWith(`/enterprise/staff-departure/${id}/review`, undefined, { signal });
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/staff-departure/${id}/complete`, body);
});
it.each(STAFF_DEPARTURE_COUNTS)('rejects unsafe count and contradictory eligible %s', async key => {
  for (const n of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '0', 1]) {
    const r = departureReview();
    (r.counts as any)[key] = n;
    api.get.mockResolvedValue({ data: r });
    await expect(reviewStaffDeparture(departureRecord(), admin)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it.each([
  { organizationVersion: 5 },
  { requestVersion: 2 },
  { userId: 5 },
  { organizationId: 8 },
  { requestId: 'bad' },
  { basis: 'bad' },
  { checkedAt: 'bad' },
  { blockers: ['unknown'], eligible: false },
  { blockers: ['last_admin', 'last_admin'], eligible: false },
  { counts: {} },
  { internalHash: 'private' },
])('rejects stale/private review %s', async patch => {
  api.get.mockResolvedValue({ data: { ...departureReview(), ...patch } });
  await expect(reviewStaffDeparture(departureRecord(), admin)).rejects.toMatchObject({ kind: 'invalid' });
});
it('blocks self review/complete, non-admin and cross-org before networking', async () => {
  for (const s of [scope, { ...admin, isAdmin: false }, { ...admin, organizationId: 8 }]) {
    await expect(reviewStaffDeparture(departureRecord(), s)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(
      completeStaffDeparture(
        departureRecord(),
        { expectedVersion: 1, reviewBasis: 'a'.repeat(64), acknowledgedDeparture: true },
        s,
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  }
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('cancels only own requested record even after leaving; rejects malformed write inputs', async () => {
  api.post.mockResolvedValue({
    data: departureRecord({ version: 2, status: 'cancelled', cancelledAt: new Date().toISOString() }),
  });
  await cancelStaffDeparture(departureRecord(), { ...scope, organizationId: null, organizationVersion: null });
  expect(api.post).toHaveBeenCalledExactlyOnceWith(`/enterprise/staff-departure/${id}/cancel`, {
    expectedVersion: 1,
    acknowledgedDeparture: true,
  });
  api.post.mockClear();
  await expect(cancelStaffDeparture(departureRecord(), admin)).rejects.toBeTruthy();
  for (const body of [
    { ...input, extra: true },
    { ...input, acknowledgedDeparture: false },
    { ...input, expectedOrganizationVersion: 5 },
    { ...input, requestId: 'bad' },
  ])
    await expect(requestStaffDeparture(body as any, scope)).rejects.toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});
it.each([401, 403, 404, 409, 500])('maps HTTP %s without leaking backend bodies', async status => {
  api.get.mockRejectedValue({ response: { status, data: { message: 'private' } } });
  await expect(fetchStaffDeparture(id, scope)).rejects.toMatchObject({ status });
});
