import { get, post } from '@/helpers/apiHelper';
import { editorDraftKey } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';

export const dashboardLifecycleLabels = {
  directPermissions: '직접 권한',
  groupPermissions: '그룹 권한',
  directDeliveries: '개인 조회 공유',
  groupDeliveries: '그룹 조회 공유',
  liveShare: '실시간 공유',
  legacyPublications: '기존 게시',
  studioPublications: 'Studio 게시',
  sharedShareRecords: '다른 대시보드의 공유 연결',
};
export type DashboardLifecycleState = {
  dashboardId: number;
  actorId: number;
  organizationId: number;
  active: boolean;
  version: number;
  revision: string;
  dependencies: Array<{ kind: keyof typeof dashboardLifecycleLabels; count: number }>;
};
export type DashboardLifecycleRequest = {
  requestId: string;
  expectedActorId: number;
  expectedOrganizationId: number;
  expectedVersion: number;
  expectedRevision: string;
  active: boolean;
  acknowledgedImpact: true;
};
export type DashboardLifecycleReceipt = {
  dashboardId: number;
  actorId: number;
  organizationId: number;
  requestId: string;
  receiptId: number;
  active: boolean;
  version: number;
  replayed: boolean;
};
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const version = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const revision = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function validDashboardLifecycleRequest(value: any): value is DashboardLifecycleRequest {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 7 &&
    uuid(value.requestId) &&
    positive(value.expectedActorId) &&
    positive(value.expectedOrganizationId) &&
    version(value.expectedVersion) &&
    value.expectedVersion < Number.MAX_SAFE_INTEGER &&
    revision(value.expectedRevision) &&
    typeof value.active === 'boolean' &&
    value.acknowledgedImpact === true
  );
}
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('invalid lifecycle envelope');
  return response.data.data;
};
export const dashboardLifecyclePath = (id: number) => `/enterprise/resources/dashboard/${id}/lifecycle`;
export async function fetchDashboardLifecycle(id: number, signal?: AbortSignal): Promise<DashboardLifecycleState> {
  if (!positive(id)) throw new Error('invalid dashboard');
  const value = unwrap(await get(dashboardLifecyclePath(id), undefined, { signal }));
  const kinds = Object.keys(dashboardLifecycleLabels);
  if (
    !value ||
    value.dashboardId !== id ||
    !positive(value.actorId) ||
    !positive(value.organizationId) ||
    typeof value.active !== 'boolean' ||
    !version(value.version) ||
    !revision(value.revision) ||
    !Array.isArray(value.dependencies) ||
    value.dependencies.length !== kinds.length ||
    !value.dependencies.every((entry: any) => kinds.includes(entry?.kind) && version(entry?.count)) ||
    new Set(value.dependencies.map((entry: any) => entry.kind)).size !== kinds.length
  )
    throw new Error('invalid lifecycle state');
  return {
    dashboardId: id,
    actorId: value.actorId,
    organizationId: value.organizationId,
    active: value.active,
    version: value.version,
    revision: value.revision,
    dependencies: value.dependencies.map(({ kind, count }) => ({ kind, count })),
  };
}
export async function saveDashboardLifecycle(
  id: number,
  body: DashboardLifecycleRequest,
): Promise<DashboardLifecycleReceipt> {
  if (!positive(id) || !validDashboardLifecycleRequest(body)) throw new Error('confirmed lifecycle request required');
  const value = unwrap(await post(dashboardLifecyclePath(id), { ...body }));
  if (
    !value ||
    value.dashboardId !== id ||
    value.actorId !== body.expectedActorId ||
    value.organizationId !== body.expectedOrganizationId ||
    value.requestId !== body.requestId ||
    !positive(value.receiptId) ||
    value.active !== body.active ||
    value.version !== body.expectedVersion + 1 ||
    typeof value.replayed !== 'boolean'
  )
    throw new Error('invalid lifecycle receipt');
  return {
    dashboardId: id,
    actorId: value.actorId,
    organizationId: value.organizationId,
    requestId: value.requestId,
    receiptId: value.receiptId,
    active: value.active,
    version: value.version,
    replayed: value.replayed,
  };
}
export const DASHBOARD_LIFECYCLE_PENDING_TTL = 24 * 60 * 60 * 1000;
export const DASHBOARD_LIFECYCLE_PENDING_LIMIT = 8192;
export async function dashboardLifecyclePendingKey(id: number, organizationId: number): Promise<string | null> {
  const scope = personalLibrarySessionScope();
  if (!scope || !positive(id) || !positive(organizationId)) return null;
  const key = await editorDraftKey(getToken(), id);
  if (personalLibrarySessionScope() !== scope) throw new Error('session changed');
  return key ? `${key}:dashboard-lifecycle:${organizationId}:${encodeURIComponent(scope)}` : null;
}
export function readDashboardLifecyclePending(
  key: string | null,
  id: number,
  org: number,
  now = Date.now(),
): DashboardLifecycleRequest | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = new TextEncoder().encode(raw).length <= DASHBOARD_LIFECYCLE_PENDING_LIMIT ? JSON.parse(raw) : null;
    if (
      value &&
      Object.keys(value).length === 4 &&
      value.version === 1 &&
      value.dashboardId === id &&
      Number.isFinite(value.updatedAt) &&
      value.updatedAt <= now + 60000 &&
      now - value.updatedAt < DASHBOARD_LIFECYCLE_PENDING_TTL &&
      validDashboardLifecycleRequest(value.request) &&
      value.request.expectedOrganizationId === org
    )
      return Object.freeze(value.request);
  } catch {
    /* Untrusted optional storage is never executed automatically. */
  }
  removeDashboardLifecyclePending(key);
  return null;
}
export function writeDashboardLifecyclePending(key: string | null, id: number, request: DashboardLifecycleRequest): boolean {
  try {
    if (!key || !positive(id) || !validDashboardLifecycleRequest(request)) return false;
    const raw = JSON.stringify({ version: 1, updatedAt: Date.now(), dashboardId: id, request });
    if (new TextEncoder().encode(raw).length > DASHBOARD_LIFECYCLE_PENDING_LIMIT) return false;
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export function removeDashboardLifecyclePending(key: string | null) {
  try {
    if (key) sessionStorage.removeItem(key);
  } catch {
    /* Preserve unrelated editor drafts. */
  }
}

/** HttpExceptionFilter nests the Nest exception under data and puts the HTTP number in outer code.
 * Proxies may return the exception directly. Only an explicit stale code proves a 409 rejected the basis.
 */
export function isDashboardLifecycleStale(error: any): boolean {
  if (error?.response?.status !== 409) return false;
  const body = error.response.data;
  const code = typeof body?.code === 'string' ? body.code : body?.data?.code;
  return code === 'DASHBOARD_LIFECYCLE_STALE';
}
