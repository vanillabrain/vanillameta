import { STAFF_DEPARTURE_COUNTS, StaffDepartureRecord, StaffDepartureReview } from './staffDepartureService';
export const departureId = '533c472f-b03d-40a1-804c-4af4d787506c';
export const departureScope = { actorId: 3, organizationId: 7, organizationVersion: 4, isAdmin: false };
export const departureRecord = (patch: Partial<StaffDepartureRecord> = {}): StaffDepartureRecord => ({
  requestId: departureId,
  userId: 3,
  organizationId: 7,
  version: 1,
  status: 'requested',
  requestedAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 899000).toISOString(),
  completedAt: null,
  cancelledAt: null,
  completedBy: null,
  completeOrganizationVersion: null,
  replayed: false,
  ...patch,
});
export const departureReview = (patch: Partial<StaffDepartureReview> = {}): StaffDepartureReview => ({
  requestId: departureId,
  userId: 3,
  organizationId: 7,
  requestVersion: 1,
  organizationVersion: 4,
  checkedAt: new Date().toISOString(),
  basis: 'a'.repeat(64),
  eligible: true,
  blockers: [],
  counts: Object.fromEntries(STAFF_DEPARTURE_COUNTS.map(k => [k, 0])) as StaffDepartureReview['counts'],
  ...patch,
});
export const completedDeparture = () =>
  departureRecord({
    version: 2,
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: 4,
    completeOrganizationVersion: 5,
  });
