import { get, post } from '@/helpers/apiHelper';
export type GroupDelivery = { groupId: number; version: number; active: boolean; allowCopy: boolean };
export type GroupDeliveryInput = Omit<GroupDelivery, 'version'> & {
  requestId: string;
  expectedVersion: number;
  expectedGroupVersion: number;
};
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
