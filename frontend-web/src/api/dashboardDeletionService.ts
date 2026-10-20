import { del, get } from '@/helpers/apiHelper';

export const deletionDependencyLabels = {
  directPermissions: '직접 권한',
  groupPermissions: '그룹 권한',
  directDeliveries: '개인 조회 공유',
  groupDeliveries: '그룹 조회 공유',
  liveShare: '실시간 공유',
  legacyPublications: '기존 게시',
  studioPublications: 'Studio 게시',
  sharedShareRecords: '다른 대시보드의 공유 연결',
};
export type DeletionDependencyKind = keyof typeof deletionDependencyLabels;
export type DashboardDeleteImpact = {
  dashboardId: number;
  actorId: number;
  organizationId: number | null;
  revision: string;
  canDelete: boolean;
  dependencies: Array<{ kind: DeletionDependencyKind; count: number }>;
};
export type DashboardDeleteRequest = {
  requestId: string;
  expectedRevision: string;
  expectedActorId: number;
  expectedOrganizationId: number | null;
};
export type DashboardDeleteReceipt = {
  dashboardId: number;
  requestId: string;
  receiptId: number;
  deleted: true;
  replayed: boolean;
};
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const revision = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown) =>
  typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('invalid deletion envelope');
  return response.data.data;
};
export async function fetchDashboardDeleteImpact(id: number, signal?: AbortSignal): Promise<DashboardDeleteImpact> {
  if (!positive(id)) throw new Error('invalid dashboard target');
  const data = unwrap(await get(`/dashboard/${id}/delete-impact`, undefined, { signal }));
  const kinds = Object.keys(deletionDependencyLabels);
  if (
    !data ||
    data.dashboardId !== id ||
    !positive(data.actorId) ||
    !(data.organizationId === null || positive(data.organizationId)) ||
    !revision(data.revision) ||
    typeof data.canDelete !== 'boolean' ||
    !Array.isArray(data.dependencies) ||
    data.dependencies.length !== kinds.length ||
    !data.dependencies.every(
      (entry: any) => kinds.includes(entry?.kind) && Number.isSafeInteger(entry.count) && entry.count >= 0,
    ) ||
    new Set(data.dependencies.map((entry: any) => entry.kind)).size !== kinds.length ||
    data.canDelete !== data.dependencies.every((entry: any) => entry.count === 0)
  )
    throw new Error('invalid deletion impact');
  return data;
}
export async function submitDashboardDeletion(id: number, body: DashboardDeleteRequest): Promise<DashboardDeleteReceipt> {
  if (
    !positive(id) ||
    !body ||
    Object.keys(body).length !== 4 ||
    !uuid(body.requestId) ||
    !revision(body.expectedRevision) ||
    !positive(body.expectedActorId) ||
    !(body.expectedOrganizationId === null || positive(body.expectedOrganizationId))
  )
    throw new Error('confirmed deletion request required');
  const data = unwrap(await del(`/dashboard/${id}`, { data: { ...body } }));
  if (
    !data ||
    data.dashboardId !== id ||
    data.requestId !== body.requestId ||
    !positive(data.receiptId) ||
    data.deleted !== true ||
    typeof data.replayed !== 'boolean'
  )
    throw new Error('invalid deletion receipt');
  return data;
}
export function dashboardDeletionError(error: any): string {
  if (error?.response?.status === 409) return '삭제 기준이나 사용처가 변경되었습니다. 사용처를 다시 읽고 확인해 주세요.';
  if (error?.response?.status === 401 || error?.response?.status === 403)
    return '현재 계정의 소유권·조직·로그인을 확인해 주세요. 삭제 결과가 확인되지 않았다면 같은 요청을 재확인하세요.';
  return '삭제 결과를 확인하지 못했습니다. 같은 요청으로 결과를 확인해 주세요.';
}
