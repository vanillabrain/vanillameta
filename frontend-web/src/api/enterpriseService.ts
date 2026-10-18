// UC051 organization/member boundary. The /enterprise endpoints answer with the raw payload,
// not the legacy SUCCESS envelope, so nothing here unwraps `status`/`data`.
import { del, get, patch, post } from '@/helpers/apiHelper';

export type EnterpriseRole = 'admin' | 'member';

export type EnterpriseContext = {
  organization: { id: number; name: string; version: number } | null;
  membership: { userId: number; role: EnterpriseRole; team: string } | null;
};

export type EnterpriseMember = {
  id: number;
  /** Login identifier of the member account, kept verbatim from the server (never compared numerically). */
  userId: string;
  team: string;
  role: EnterpriseRole;
  active: boolean;
};

export type EnterpriseMemberPage = {
  organizationVersion: number;
  entries: EnterpriseMember[];
  nextAfterId: number | null;
};

export type EnterpriseMemberWrite = {
  organizationVersion: number;
  member: EnterpriseMember;
};

/** One-time, 15-minute consent code the recipient hands to the inviting admin. */
export type EnterpriseEnrollment = {
  enrollmentCode: string;
  expiresAt: string;
  /** The single organization this code is bound to. Reusing it anywhere else is refused. */
  organization: { id: number; name: string };
};

export type EnterpriseRoleInput = { team: string; role: EnterpriseRole; active: boolean; expectedVersion: number };

/** Conflict means the organization moved on; the draft stays and the viewer must reload. */
export type EnterpriseErrorKind = 'forbidden' | 'conflict' | 'auth' | 'invalid' | 'network';

export class EnterpriseApiError extends Error {
  readonly kind: EnterpriseErrorKind;
  readonly status: number | null;
  constructor(message: string, kind: EnterpriseErrorKind, status: number | null = null) {
    super(message);
    this.name = 'EnterpriseApiError';
    this.kind = kind;
    this.status = status;
  }
}

const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120;

/** Server-side limits: organization/team names are trimmed to 100, the login id to 255. */
export const MAX_ORGANIZATION_NAME_LENGTH = 100;
export const MAX_TEAM_LENGTH = 100;
export const MAX_USER_ID_LENGTH = 255;

/** Fail closed on unknown payloads; a partial organization or membership is never rendered. */
const contextShape = (input: any): input is EnterpriseContext => {
  if (!input || typeof input !== 'object') return false;
  if (input.organization === null && input.membership === null) return true;
  return (
    !!input.organization &&
    !!input.membership &&
    positiveInteger(input.organization.id) &&
    text(input.organization.name) &&
    input.organization.name.length <= MAX_ORGANIZATION_NAME_LENGTH &&
    Number.isSafeInteger(input.organization.version) &&
    input.organization.version >= 0 &&
    positiveInteger(input.membership.userId) &&
    (input.membership.role === 'admin' || input.membership.role === 'member') &&
    typeof input.membership.team === 'string'
  );
};

export const MAX_ENROLLMENT_CODE_LENGTH = 64;
/** Acceptance code is a one-time 64-character lowercase hex digest; anything else never leaves the client. */
export const ENROLLMENT_CODE_PATTERN = /^[0-9a-f]{64}$/;

const memberShape = (input: any): input is EnterpriseMember =>
  !!input &&
  typeof input === 'object' &&
  positiveInteger(input.id) &&
  typeof input.userId === 'string' &&
  input.userId.length > 0 &&
  input.userId.length <= MAX_USER_ID_LENGTH &&
  typeof input.team === 'string' &&
  input.team.length <= MAX_TEAM_LENGTH &&
  (input.role === 'admin' || input.role === 'member') &&
  typeof input.active === 'boolean';

const pageShape = (input: any): input is EnterpriseMemberPage =>
  !!input &&
  typeof input === 'object' &&
  Number.isSafeInteger(input.organizationVersion) &&
  input.organizationVersion >= 0 &&
  Array.isArray(input.entries) &&
  input.entries.every(memberShape) &&
  (input.nextAfterId === null || positiveInteger(input.nextAfterId));

const writeShape = (input: any): input is EnterpriseMemberWrite =>
  !!input &&
  typeof input === 'object' &&
  Number.isSafeInteger(input.organizationVersion) &&
  input.organizationVersion >= 0 &&
  memberShape(input.member);

const enrollmentShape = (input: any): input is EnterpriseEnrollment =>
  !!input &&
  typeof input === 'object' &&
  typeof input.enrollmentCode === 'string' &&
  ENROLLMENT_CODE_PATTERN.test(input.enrollmentCode) &&
  typeof input.expiresAt === 'string' &&
  !Number.isNaN(Date.parse(input.expiresAt)) &&
  !!input.organization &&
  positiveInteger(input.organization.id) &&
  typeof input.organization.name === 'string' &&
  input.organization.name.length > 0 &&
  input.organization.name.length <= MAX_ORGANIZATION_NAME_LENGTH;

const revokedShape = (input: any): input is { revoked: boolean } =>
  !!input && typeof input === 'object' && input.revoked === true;

export const isEnrollmentCode = (value: unknown): value is string =>
  typeof value === 'string' && ENROLLMENT_CODE_PATTERN.test(value);

const invalid = (message: string): EnterpriseApiError => new EnterpriseApiError(message, 'invalid');

export const rawPayload = <T>(response: { data?: unknown }, shape: (input: unknown) => input is T): T => {
  const payload = response?.data;
  if (!shape(payload)) throw invalid('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return payload;
};

const reasonFrom = (body: any): string | undefined => {
  const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const data = body?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (Array.isArray(data)) return data.join(' · ');
  return undefined;
};

export const enterpriseError = (error: unknown): EnterpriseApiError => {
  if (error instanceof EnterpriseApiError) return error;
  const status = (error as { response?: { status?: number } })?.response?.status;
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  const reason = reasonFrom(body);
  if (status === 401) return new EnterpriseApiError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 'auth', status);
  if (status === 403) return new EnterpriseApiError(reason ?? '조직 정보를 볼 권한이 없습니다.', 'forbidden', status);
  if (status === 409)
    return new EnterpriseApiError(
      reason ?? '조직 정보가 변경되었습니다. 최신 정보를 다시 불러와 주세요.',
      'conflict',
      status,
    );
  if (status === 400 || status === 422)
    return new EnterpriseApiError(reason ?? '입력값을 다시 확인해 주세요.', 'invalid', status);
  if (status === undefined)
    return new EnterpriseApiError('서버와 통신하지 못했습니다. 입력값을 그대로 두고 다시 시도해 주세요.', 'network', null);
  return new EnterpriseApiError(reason ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'invalid', status);
};

export const fetchContext = (config: Record<string, unknown> = {}): Promise<EnterpriseContext> =>
  get('/enterprise/context', undefined, config).then(response => rawPayload<EnterpriseContext>(response, contextShape));

export const createOrganization = (name: string): Promise<EnterpriseContext> =>
  post('/enterprise/organizations', { name }).then(response => rawPayload<EnterpriseContext>(response, contextShape));

export const fetchMembers = (
  afterId?: number,
  config: Record<string, unknown> = {},
  q?: string,
): Promise<EnterpriseMemberPage> => {
  if (q !== undefined && (typeof q !== 'string' || q.length > 100))
    return Promise.reject(invalid('직원 검색어는 100자 이내로 입력해 주세요.'));
  return get('/enterprise/members', { ...(afterId === undefined ? {} : { afterId }), ...(q ? { q } : {}) }, config).then(
    response => rawPayload<EnterpriseMemberPage>(response, pageShape),
  );
};

export const addMember = (input: {
  /** Login id of the existing account, matched verbatim by the server (never a numeric internal id). */
  userId: string;
  team: string;
  role: EnterpriseRole;
  /** Consent code the recipient issued for this exact account. The body never carries an organization id. */
  enrollmentCode: string;
  expectedVersion: number;
}): Promise<EnterpriseMemberWrite> => post('/enterprise/members', input).then(response => rawPayload(response, writeShape));

/** Consent is scoped to one organization id the recipient types explicitly; there is no directory lookup. */
export const createEnrollment = (organizationId: number): Promise<EnterpriseEnrollment> =>
  post('/enterprise/enrollment', { organizationId }).then(response =>
    rawPayload<EnterpriseEnrollment>(response, enrollmentShape),
  );

/** Rejecting consent removes the pending code; a failed revoke keeps it visible for a retry. */
export const revokeEnrollment = (): Promise<{ revoked: boolean }> =>
  del('/enterprise/enrollment').then(response => rawPayload(response, revokedShape));

export const updateMember = (id: number, input: EnterpriseRoleInput): Promise<EnterpriseMemberWrite> =>
  patch(`/enterprise/members/${id}`, input).then(response => rawPayload(response, writeShape));

const enterpriseService = {
  fetchContext,
  createOrganization,
  fetchMembers,
  addMember,
  updateMember,
  createEnrollment,
  revokeEnrollment,
};

export default enterpriseService;

export type PersonalNotification = {
  id: number;
  resourceId: number;
  /** Version recorded by this historical event, not the current resource/job version. */
  version: number;
  createdAt: string;
  read: boolean;
} & (
  | { resourceKind: 'source'; eventType: 'permissions'; viaGroup?: never }
  | { resourceKind: 'dashboard'; eventType: 'permissions' | 'shared' | 'unshared'; viaGroup?: boolean }
  | { resourceKind: 'export'; eventType: 'ready' | 'failed' | 'cancelled'; viaGroup?: never }
);
export type NotificationPage = { entries: PersonalNotification[]; nextBeforeId: number | null };
const notificationShape = (entry: any): entry is PersonalNotification =>
  !!entry &&
  positiveInteger(entry.id) &&
  (entry.resourceKind === 'export'
    ? ['ready', 'failed', 'cancelled'].includes(entry.eventType) && entry.viaGroup === undefined
    : entry.resourceKind === 'source'
    ? entry.eventType === 'permissions' && entry.viaGroup === undefined
    : entry.resourceKind === 'dashboard' &&
      ['permissions', 'shared', 'unshared'].includes(entry.eventType) &&
      (entry.viaGroup === undefined ||
        (entry.viaGroup === true && entry.resourceKind === 'dashboard' && entry.eventType !== 'permissions'))) &&
  positiveInteger(entry.resourceId) &&
  positiveInteger(entry.version) &&
  typeof entry.createdAt === 'string' &&
  Number.isFinite(Date.parse(entry.createdAt)) &&
  typeof entry.read === 'boolean';
export const fetchNotifications = (beforeId?: number): Promise<NotificationPage> =>
  get('/enterprise/notifications', beforeId === undefined ? {} : { beforeId }).then(response =>
    rawPayload<NotificationPage>(
      response,
      (data: any): data is NotificationPage =>
        !!data &&
        Array.isArray(data.entries) &&
        data.entries.length <= 20 &&
        data.entries.every(notificationShape) &&
        (data.nextBeforeId === null ||
          (positiveInteger(data.nextBeforeId) &&
            data.entries.length > 0 &&
            data.nextBeforeId === data.entries[data.entries.length - 1].id)) &&
        data.entries.every(
          (entry: PersonalNotification, index: number) =>
            (beforeId === undefined || entry.id < beforeId) && (index === 0 || entry.id < data.entries[index - 1].id),
        ),
    ),
  );
export const markNotification = (
  id: number,
  action: 'read' | 'remove',
): Promise<{ id: number; read: boolean; removed: boolean }> =>
  post(`/enterprise/notifications/${id}/${action}`, {}).then(response =>
    rawPayload(
      response,
      (data: any): data is { id: number; read: boolean; removed: boolean } =>
        !!data &&
        data.id === id &&
        typeof data.read === 'boolean' &&
        typeof data.removed === 'boolean' &&
        (action === 'read' ? data.read === true : data.removed === true),
    ),
  );
