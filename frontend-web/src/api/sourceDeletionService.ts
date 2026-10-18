import { del, get, post } from '@/helpers/apiHelper';

export const sourceDeletionDependencyLabels = {
  datasets: '데이터셋',
  tableQueries: '테이블 쿼리',
  metrics: '사용 중 지표',
  dashboards: '대시보드',
  exploreViews: '탐색 보기',
  directPermissions: '직접 권한',
  groupPermissions: '그룹 권한',
  publications: '게시',
  exportJobs: '출력 작업·미만료 파일',
  sharedFiles: '다른 소스의 파일 참조',
};
export type DeletionDependencyKind = keyof typeof sourceDeletionDependencyLabels;
export type SourceDeleteImpact = {
  sourceId: number;
  actorId: number;
  organizationId: number | null;
  revision: string;
  canDelete: boolean;
  managedFileCount: number;
  dependencies: Array<{ kind: DeletionDependencyKind; count: number }>;
};
export type SourceDeleteRequest = {
  requestId: string;
  expectedRevision: string;
  expectedActorId: number;
  expectedOrganizationId: number | null;
};
export type SourceDeleteReceipt = {
  sourceId: number;
  requestId: string;
  receiptId: number;
  deleted: true;
  replayed: boolean;
  cleanup: { status: 'pending' | 'complete' | 'retry_required'; managedFiles: number };
};
const nonnegative = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const revision = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown) =>
  typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('invalid deletion envelope');
  return response.data.data;
};
export async function fetchSourceDeleteImpact(id: number, signal?: AbortSignal): Promise<SourceDeleteImpact> {
  if (!positive(id)) throw new Error('invalid source target');
  const data = unwrap(await get(`/database/${id}/delete-impact`, undefined, { signal }));
  const kinds = Object.keys(sourceDeletionDependencyLabels);
  if (
    !data ||
    data.sourceId !== id ||
    !positive(data.actorId) ||
    !(data.organizationId === null || positive(data.organizationId)) ||
    !revision(data.revision) ||
    !nonnegative(data.managedFileCount) ||
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
export async function submitSourceDeletion(id: number, body: SourceDeleteRequest): Promise<SourceDeleteReceipt> {
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
  const data = unwrap(await del(`/database/${id}`, { data: { ...body } }));
  const receipt = validateReceipt(data);
  if (receipt.sourceId !== id || receipt.requestId !== body.requestId) throw new Error('mismatched deletion receipt');
  return receipt;
}
function validateReceipt(data: any): SourceDeleteReceipt {
  if (
    !data ||
    !positive(data.sourceId) ||
    !uuid(data.requestId) ||
    !positive(data.receiptId) ||
    data.deleted !== true ||
    typeof data.replayed !== 'boolean' ||
    !['pending', 'complete', 'retry_required'].includes(data.cleanup?.status) ||
    !nonnegative(data.cleanup?.managedFiles)
  )
    throw new Error('invalid deletion receipt');
  return {
    sourceId: data.sourceId,
    requestId: data.requestId,
    receiptId: data.receiptId,
    deleted: true,
    replayed: data.replayed,
    cleanup: { status: data.cleanup.status, managedFiles: data.cleanup.managedFiles },
  };
}
export async function fetchSourceDeletionReceipt(
  receipt: SourceDeleteReceipt,
  signal?: AbortSignal,
): Promise<SourceDeleteReceipt> {
  const expected = validateReceipt(receipt);
  const value = validateReceipt(unwrap(await get(`/database/deletions/${expected.receiptId}`, undefined, { signal })));
  if (
    value.receiptId !== expected.receiptId ||
    value.sourceId !== expected.sourceId ||
    value.requestId !== expected.requestId ||
    value.cleanup.managedFiles !== expected.cleanup.managedFiles
  )
    throw new Error('mismatched deletion receipt');
  return value;
}
export async function cleanupSourceDeletion(receipt: SourceDeleteReceipt): Promise<SourceDeleteReceipt> {
  const expected = validateReceipt(receipt);
  const value = validateReceipt(
    unwrap(await post(`/database/deletions/${expected.receiptId}/cleanup`, { requestId: expected.requestId })),
  );
  if (
    value.receiptId !== expected.receiptId ||
    value.sourceId !== expected.sourceId ||
    value.requestId !== expected.requestId ||
    value.cleanup.managedFiles !== expected.cleanup.managedFiles
  )
    throw new Error('mismatched cleanup receipt');
  return value;
}
export type SourceDeletionHistory = {
  actorId: number;
  organizationId: number | null;
  entries: SourceDeleteReceipt[];
  nextBeforeId: number | null;
};
export async function fetchSourceDeletions(signal?: AbortSignal, beforeId?: number): Promise<SourceDeletionHistory> {
  if (beforeId !== undefined && !positive(beforeId)) throw new Error('invalid history cursor');
  const data = unwrap(await get('/database/deletions', beforeId === undefined ? undefined : { beforeId }, { signal }));
  if (
    !data ||
    !positive(data.actorId) ||
    !(data.organizationId === null || positive(data.organizationId)) ||
    !Array.isArray(data.entries) ||
    !(data.nextBeforeId === null || positive(data.nextBeforeId))
  )
    throw new Error('invalid deletion history');
  const entries = data.entries.map(validateReceipt);
  if (
    new Set(entries.map(entry => entry.receiptId)).size !== entries.length ||
    new Set(entries.map(entry => entry.requestId)).size !== entries.length
  )
    throw new Error('duplicate deletion history');
  if (
    entries.some(
      (entry, index) =>
        (beforeId !== undefined && entry.receiptId >= beforeId) ||
        (index > 0 && entry.receiptId >= entries[index - 1].receiptId),
    ) ||
    (data.nextBeforeId !== null && (entries.length === 0 || data.nextBeforeId !== entries[entries.length - 1].receiptId))
  )
    throw new Error('invalid history page');
  return { actorId: data.actorId, organizationId: data.organizationId, entries, nextBeforeId: data.nextBeforeId };
}

export function sourceDeletionError(error: any): string {
  if (error?.response?.status === 409) return '삭제 기준이나 사용처가 변경되었습니다. 사용처를 다시 읽고 확인해 주세요.';
  if (error?.response?.status === 401 || error?.response?.status === 403)
    return '현재 계정의 소유권·조직·로그인을 확인해 주세요. 삭제 결과가 확인되지 않았다면 같은 요청을 재확인하세요.';
  return '삭제 결과를 확인하지 못했습니다. 같은 요청으로 결과를 확인해 주세요.';
}
