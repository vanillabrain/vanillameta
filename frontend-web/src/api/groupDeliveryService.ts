import { get, post } from '@/helpers/apiHelper';
export type GroupDelivery = { groupId: number; version: number; active: boolean; allowCopy: boolean };
export type GroupDeliveryInput = Omit<GroupDelivery, 'version'> & {
  requestId: string;
  expectedVersion: number;
  expectedGroupVersion: number;
};
export const validGroupDeliveryInput = (v: any): v is GroupDeliveryInput =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === 6 &&
  ['requestId', 'groupId', 'expectedGroupVersion', 'expectedVersion', 'active', 'allowCopy'].every(k =>
    Object.prototype.hasOwnProperty.call(v, k),
  ) &&
  typeof v.requestId === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.requestId) &&
  Number.isSafeInteger(v.groupId) &&
  v.groupId > 0 &&
  Number.isSafeInteger(v.expectedGroupVersion) &&
  v.expectedGroupVersion > 0 &&
  Number.isSafeInteger(v.expectedVersion) &&
  v.expectedVersion >= 0 &&
  v.expectedVersion < 2147483647 &&
  typeof v.active === 'boolean' &&
  typeof v.allowCopy === 'boolean' &&
  (v.active || !v.allowCopy);
const valid = (row: any): row is GroupDelivery =>
  !!row &&
  Number.isSafeInteger(row.groupId) &&
  row.groupId > 0 &&
  Number.isSafeInteger(row.version) &&
  row.version >= 0 &&
  typeof row.active === 'boolean' &&
  typeof row.allowCopy === 'boolean' &&
  (row.active || !row.allowCopy);
export async function fetchGroupDeliveries(id: number): Promise<GroupDelivery[]> {
  const { data } = await get(`/enterprise/deliveries/dashboard/${id}/groups`, {});
  if (
    !data ||
    data.dashboardId !== id ||
    !Array.isArray(data.entries) ||
    !data.entries.every((row: any, i: number) => valid(row) && (i === 0 || row.groupId > data.entries[i - 1].groupId))
  )
    throw new Error('그룹 공유 응답을 확인할 수 없습니다.');
  return data.entries;
}
export async function saveGroupDelivery(
  id: number,
  input: GroupDeliveryInput,
): Promise<{ entry: GroupDelivery; replayed: boolean }> {
  if (!Number.isSafeInteger(id) || id <= 0 || !validGroupDeliveryInput(input))
    throw new Error('그룹 공유 요청의 번호·대상·버전을 확인해 주세요.');
  const { data } = await post(`/enterprise/deliveries/dashboard/${id}/groups`, input);
  if (
    !data ||
    data.dashboardId !== id ||
    data.requestId !== input.requestId ||
    !valid(data.entry) ||
    data.entry.groupId !== input.groupId ||
    data.entry.active !== input.active ||
    data.entry.allowCopy !== input.allowCopy ||
    typeof data.replayed !== 'boolean'
  )
    throw new Error('그룹 공유 결과를 확인할 수 없습니다. 같은 요청으로 확인해 주세요.');
  return data;
}
