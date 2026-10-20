import { isHandoverId } from './handoverService';
import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';

export const DEPARTURE_COUNT_KEYS = [
  'sources',
  'metrics',
  'soleDashboards',
  'ambiguousDashboards',
  'directGrants',
  'personalDeliveries',
  'groupMemberships',
  'ownedGroupGrants',
  'ownedGroupDeliveries',
  'publications',
  'exportJobs',
] as const;
export type DepartureCountKey = (typeof DEPARTURE_COUNT_KEYS)[number];
export type DepartureScope = { organizationId: number; organizationVersion: number; targetId: number };
export type StaffDepartureImpact = DepartureScope & {
  targetActive: boolean;
  observedAt: string;
  counts: Record<DepartureCountKey, number>;
};
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
const exactKeys = (value: unknown, keys: readonly string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.prototype.hasOwnProperty.call(value, key));

/** Only this explicit read is available: no directory lookup, content read, or mutation. */
export const fetchStaffDepartureImpact = async (
  scope: DepartureScope,
  config: Record<string, unknown> = {},
): Promise<StaffDepartureImpact> => {
  try {
    if (!positive(scope.organizationId) || !positive(scope.targetId) || !nonnegative(scope.organizationVersion))
      throw new EnterpriseApiError('현재 조직과 직원 번호·버전을 다시 확인해 주세요.', 'invalid');
    return rawPayload(
      await get(`/enterprise/members/${scope.targetId}/departure-impact`, undefined, config),
      (data: any): data is StaffDepartureImpact =>
        exactKeys(data, ['organizationId', 'organizationVersion', 'targetId', 'targetActive', 'observedAt', 'counts']) &&
        positive(data.organizationId) &&
        data.organizationId === scope.organizationId &&
        nonnegative(data.organizationVersion) &&
        data.organizationVersion === scope.organizationVersion &&
        positive(data.targetId) &&
        data.targetId === scope.targetId &&
        typeof data.targetActive === 'boolean' &&
        typeof data.observedAt === 'string' &&
        Number.isFinite(Date.parse(data.observedAt)) &&
        exactKeys(data.counts, DEPARTURE_COUNT_KEYS) &&
        DEPARTURE_COUNT_KEYS.every(key => nonnegative(data.counts[key])),
    );
  } catch (error) {
    throw enterpriseError(error);
  }
};

export type StaffDepartureScope = {
  actorId: number;
  organizationId: number | null;
  organizationVersion: number | null;
  isAdmin: boolean;
};
export type StaffDepartureRecord = {
  requestId: string;
  userId: number;
  organizationId: number;
  version: number;
  status: 'requested' | 'completed' | 'cancelled';
  requestedAt: string;
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  completedBy: number | null;
  completeOrganizationVersion: number | null;
  replayed: boolean;
};
export const STAFF_DEPARTURE_COUNTS = [
  'ownedSources',
  'ownedDashboards',
  'activePublications',
  'openExports',
  'openRefreshes',
  'openExecutions',
  'pendingHandovers',
  'pendingTransfer',
  'pendingCleanup',
] as const;
export const STAFF_DEPARTURE_BLOCKERS = [
  'owned_assets',
  'active_publications',
  'open_work',
  'pending_handover',
  'pending_transfer',
  'last_admin',
  'unsupported_state',
] as const;
export type StaffDepartureReview = {
  requestId: string;
  userId: number;
  organizationId: number;
  requestVersion: number;
  organizationVersion: number;
  checkedAt: string;
  basis: string;
  eligible: boolean;
  blockers: (typeof STAFF_DEPARTURE_BLOCKERS)[number][];
  counts: Record<(typeof STAFF_DEPARTURE_COUNTS)[number], number>;
};
export type DepartureRequestInput = { requestId: string; expectedOrganizationVersion: number; acknowledgedDeparture: true };
export type DepartureCompleteInput = { expectedVersion: number; reviewBasis: string; acknowledgedDeparture: true };
export const exactDepartureKeys = exactKeys;
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const basisShape = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const validDepartureRequest = (v: any): v is DepartureRequestInput =>
  exactKeys(v, ['requestId', 'expectedOrganizationVersion', 'acknowledgedDeparture']) &&
  isHandoverId(v.requestId) &&
  nonnegative(v.expectedOrganizationVersion) &&
  v.acknowledgedDeparture === true;
export const validDepartureComplete = (v: any): v is DepartureCompleteInput =>
  exactKeys(v, ['expectedVersion', 'reviewBasis', 'acknowledgedDeparture']) &&
  v.expectedVersion === 1 &&
  basisShape(v.reviewBasis) &&
  v.acknowledgedDeparture === true;
const validScope = (s: StaffDepartureScope) =>
  positive(s.actorId) &&
  typeof s.isAdmin === 'boolean' &&
  (s.organizationId === null
    ? s.organizationVersion === null && !s.isAdmin
    : positive(s.organizationId) && nonnegative(s.organizationVersion));
const invalid = () =>
  new EnterpriseApiError('현재 계정·조직·탈퇴 요청의 확인 기준이 맞지 않습니다. 다시 조회해 주세요.', 'invalid');
const recordShape = (v: any, id: string, s: StaffDepartureScope): v is StaffDepartureRecord => {
  if (
    !exactKeys(v, [
      'requestId',
      'userId',
      'organizationId',
      'version',
      'status',
      'requestedAt',
      'expiresAt',
      'completedAt',
      'cancelledAt',
      'completedBy',
      'completeOrganizationVersion',
      'replayed',
    ]) ||
    v.requestId !== id ||
    !positive(v.userId) ||
    !positive(v.organizationId) ||
    typeof v.replayed !== 'boolean' ||
    !timestamp(v.requestedAt) ||
    !timestamp(v.expiresAt) ||
    Date.parse(v.expiresAt) <= Date.parse(v.requestedAt)
  )
    return false;
  // Own historical receipts remain readable after leaving or joining another organization.
  if (v.userId !== s.actorId && !(s.isAdmin && v.organizationId === s.organizationId)) return false;
  if (v.status === 'requested')
    return (
      v.version === 1 &&
      v.completedAt === null &&
      v.cancelledAt === null &&
      v.completedBy === null &&
      v.completeOrganizationVersion === null
    );
  if (v.version !== 2) return false;
  if (v.status === 'cancelled')
    return (
      timestamp(v.cancelledAt) &&
      Date.parse(v.cancelledAt) >= Date.parse(v.requestedAt) &&
      v.completedAt === null &&
      v.completedBy === null &&
      v.completeOrganizationVersion === null
    );
  return (
    v.status === 'completed' &&
    timestamp(v.completedAt) &&
    Date.parse(v.completedAt) >= Date.parse(v.requestedAt) &&
    v.cancelledAt === null &&
    positive(v.completedBy) &&
    v.completedBy !== v.userId &&
    positive(v.completeOrganizationVersion)
  );
};
const adminRecord = (r: StaffDepartureRecord, s: StaffDepartureScope) =>
  validScope(s) &&
  recordShape(r, r.requestId, s) &&
  r.status === 'requested' &&
  s.isAdmin &&
  s.organizationId === r.organizationId &&
  s.actorId !== r.userId;
const reviewShape = (v: any, r: StaffDepartureRecord, s: StaffDepartureScope): v is StaffDepartureReview => {
  if (
    !exactKeys(v, [
      'requestId',
      'userId',
      'organizationId',
      'requestVersion',
      'organizationVersion',
      'checkedAt',
      'basis',
      'eligible',
      'blockers',
      'counts',
    ]) ||
    v.requestId !== r.requestId ||
    v.userId !== r.userId ||
    v.organizationId !== r.organizationId ||
    v.requestVersion !== r.version ||
    v.organizationVersion !== s.organizationVersion ||
    !timestamp(v.checkedAt) ||
    !basisShape(v.basis) ||
    typeof v.eligible !== 'boolean' ||
    !Array.isArray(v.blockers) ||
    !v.blockers.every((b: any) => STAFF_DEPARTURE_BLOCKERS.includes(b)) ||
    new Set(v.blockers).size !== v.blockers.length ||
    v.eligible !== (v.blockers.length === 0) ||
    !exactKeys(v.counts, STAFF_DEPARTURE_COUNTS) ||
    !STAFF_DEPARTURE_COUNTS.every(k => nonnegative(v.counts[k]))
  )
    return false;
  const c = v.counts;
  return (
    (!(c.ownedSources || c.ownedDashboards) || v.blockers.includes('owned_assets')) &&
    (!c.activePublications || v.blockers.includes('active_publications')) &&
    (!(c.openExports || c.openRefreshes || c.openExecutions || c.pendingCleanup) || v.blockers.includes('open_work')) &&
    (!c.pendingHandovers || v.blockers.includes('pending_handover')) &&
    (!c.pendingTransfer || v.blockers.includes('pending_transfer'))
  );
};
export async function fetchStaffDeparture(
  id: string,
  scope: StaffDepartureScope,
  config: Record<string, unknown> = {},
): Promise<StaffDepartureRecord> {
  try {
    if (!validScope(scope) || !isHandoverId(id)) throw invalid();
    return rawPayload(
      await get(`/enterprise/staff-departure/${id}`, undefined, config),
      (v: any): v is StaffDepartureRecord => recordShape(v, id, scope),
    );
  } catch (e) {
    throw enterpriseError(e);
  }
}
export async function requestStaffDeparture(
  input: DepartureRequestInput,
  scope: StaffDepartureScope,
): Promise<StaffDepartureRecord> {
  try {
    if (
      !validScope(scope) ||
      !scope.organizationId ||
      !validDepartureRequest(input) ||
      input.expectedOrganizationVersion !== scope.organizationVersion
    )
      throw invalid();
    return rawPayload(
      await post('/enterprise/staff-departure', input),
      (v: any): v is StaffDepartureRecord =>
        recordShape(v, input.requestId, scope) && v.userId === scope.actorId && v.organizationId === scope.organizationId,
    );
  } catch (e) {
    throw enterpriseError(e);
  }
}
export async function reviewStaffDeparture(
  record: StaffDepartureRecord,
  scope: StaffDepartureScope,
  config: Record<string, unknown> = {},
): Promise<StaffDepartureReview> {
  try {
    if (!adminRecord(record, scope)) throw invalid();
    return rawPayload(
      await get(`/enterprise/staff-departure/${record.requestId}/review`, undefined, config),
      (v: any): v is StaffDepartureReview => reviewShape(v, record, scope),
    );
  } catch (e) {
    throw enterpriseError(e);
  }
}
export async function completeStaffDeparture(
  record: StaffDepartureRecord,
  input: DepartureCompleteInput,
  scope: StaffDepartureScope,
): Promise<StaffDepartureRecord> {
  try {
    if (!adminRecord(record, scope) || !validDepartureComplete(input) || input.expectedVersion !== record.version)
      throw invalid();
    return rawPayload(
      await post(`/enterprise/staff-departure/${record.requestId}/complete`, input),
      (v: any): v is StaffDepartureRecord =>
        recordShape(v, record.requestId, scope) &&
        v.userId === record.userId &&
        v.organizationId === record.organizationId &&
        v.status === 'completed' &&
        v.completedBy === scope.actorId,
    );
  } catch (e) {
    throw enterpriseError(e);
  }
}
export async function cancelStaffDeparture(
  record: StaffDepartureRecord,
  scope: StaffDepartureScope,
): Promise<StaffDepartureRecord> {
  try {
    if (
      !validScope(scope) ||
      !recordShape(record, record.requestId, scope) ||
      record.userId !== scope.actorId ||
      record.status !== 'requested'
    )
      throw invalid();
    return rawPayload(
      await post(`/enterprise/staff-departure/${record.requestId}/cancel`, {
        expectedVersion: record.version,
        acknowledgedDeparture: true,
      }),
      (v: any): v is StaffDepartureRecord =>
        recordShape(v, record.requestId, scope) &&
        v.userId === scope.actorId &&
        v.organizationId === record.organizationId &&
        v.status === 'cancelled',
    );
  } catch (e) {
    throw enterpriseError(e);
  }
}
