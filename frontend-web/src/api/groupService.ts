import { get, post } from '@/helpers/apiHelper';
import { ResourceKind, ResourceRights } from './resourcePolicyService';
export type GroupSummary = { id: number; name: string; active: boolean; version: number };
export type GroupDetail = GroupSummary & {
  members: Array<{ id: number; userId: string | null; active: boolean; current: boolean }>;
};
export type GroupPage = { entries: GroupSummary[]; nextAfterId: number | null };
export type GroupPolicy = { groupId: number; version: number; rights: ResourceRights };
const id = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const summary = (v: any): v is GroupSummary =>
  !!v && id(v.id) && typeof v.name === 'string' && v.name.length <= 100 && typeof v.active === 'boolean' && id(v.version);
const detail = (v: any): v is GroupDetail =>
  summary(v) &&
  Array.isArray((v as GroupDetail).members) &&
  (v as GroupDetail).members.length <= 200 &&
  (v as GroupDetail).members.every(
    (m: any, i: number) =>
      !!m &&
      id(m.id) &&
      typeof m.active === 'boolean' &&
      typeof m.current === 'boolean' &&
      (m.userId === null || (typeof m.userId === 'string' && m.userId.length <= 255)) &&
      (!m.current || typeof m.userId === 'string') &&
      (i === 0 || m.id > (v as GroupDetail).members[i - 1].id),
  );
const checked = <T>(v: unknown, test: (v: any) => v is T): T => {
  if (!test(v)) throw new Error('그룹 응답을 확인하지 못했습니다. 최신 상태를 다시 읽어 주세요.');
  return v;
};
export const fetchGroups = async (afterId?: number): Promise<GroupPage> => {
  const { data } = await get('/enterprise/groups', afterId === undefined ? {} : { afterId });
  return checked(
    data,
    (v: any): v is GroupPage =>
      !!v &&
      Array.isArray(v.entries) &&
      v.entries.length <= 20 &&
      v.entries.every(
        (e: any, i: number) => summary(e) && e.id > (afterId ?? 0) && (i === 0 || e.id > v.entries[i - 1].id),
      ) &&
      (v.nextAfterId === null ||
        (id(v.nextAfterId) && v.entries.length > 0 && v.nextAfterId === v.entries[v.entries.length - 1].id)),
  );
};
export const fetchGroup = async (groupId: number) => checked((await get(`/enterprise/groups/${groupId}`)).data, detail);
export const createGroup = async (name: string, requestId: string): Promise<GroupDetail & { replayed: boolean }> => {
  const { data } = await post('/enterprise/groups', { name, requestId });
  const group = checked(data, detail);
  if (typeof data.replayed !== 'boolean')
    throw new Error('그룹 생성 결과를 확인하지 못했습니다. 같은 요청으로 확인해 주세요.');
  return { ...group, replayed: data.replayed };
};
export const saveGroup = async (
  groupId: number,
  body: { name: string; active: boolean; expectedVersion: number; memberIds: number[] },
) => checked((await post(`/enterprise/groups/${groupId}`, body)).data, detail);
const rights = (v: any): v is ResourceRights =>
  !!v &&
  ['read', 'edit', 'publish', 'export'].every(k => typeof v[k] === 'boolean') &&
  (v.read || (!v.edit && !v.publish && !v.export));
export const fetchGroupPolicies = async (kind: ResourceKind, resourceId: number): Promise<GroupPolicy[]> => {
  const { data } = await get(`/enterprise/resources/${kind}/${resourceId}/group-policies`);
  if (
    data?.kind !== kind ||
    data.resourceId !== resourceId ||
    !Array.isArray(data.entries) ||
    !data.entries.every(
      (row: any, i: number) =>
        id(row.groupId) &&
        id(row.version) &&
        rights(row.rights) &&
        (kind === 'dashboard' || !row.rights.publish) &&
        (i === 0 || row.groupId > data.entries[i - 1].groupId),
    )
  )
    throw new Error('그룹 권한을 확인하지 못했습니다.');
  return data.entries;
};
export const saveGroupPolicy = async (
  kind: ResourceKind,
  resourceId: number,
  body: { groupId: number; expectedVersion: number; expectedGroupVersion: number; rights: ResourceRights },
): Promise<GroupPolicy> => {
  const { data } = await post(`/enterprise/resources/${kind}/${resourceId}/group-policies`, body);
  if (
    data?.kind !== kind ||
    data.resourceId !== resourceId ||
    data.groupId !== body.groupId ||
    data.version !== body.expectedVersion + 1 ||
    !rights(data.rights) ||
    ['read', 'edit', 'publish', 'export'].some(k => data.rights[k] !== body.rights[k])
  )
    throw new Error('그룹 권한 저장 결과를 확인하지 못했습니다. 다시 읽어 주세요.');
  return data;
};
