import { get, post } from '@/helpers/apiHelper';
import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';
export type ClassificationRef = { organizationId: number; id: number; version: number };
export type Classification = { id: number; name: string; active: boolean; version: number };
export type ClassificationPage = {
  actorId: number;
  organizationId: number;
  canManage: boolean;
  entries: Classification[];
  nextAfterId: number | null;
};
export type ClassificationCreate = {
  expectedActorId: number;
  expectedOrganizationId: number;
  requestId: string;
  name: string;
};
export type ClassificationUpdate = {
  expectedActorId: number;
  expectedOrganizationId: number;
  expectedVersion: number;
  name: string;
  active: boolean;
};
const id = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const version = (v: unknown): v is number => id(v) && v <= 2147483647;
const keys = (v: any, expected: string[]) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === expected.length &&
  Object.keys(v).every(k => expected.includes(k));
export const validClassificationRef = (v: unknown): v is ClassificationRef =>
  keys(v, ['organizationId', 'id', 'version']) && id(v['organizationId']) && id(v['id']) && version(v['version']);
export function classificationName(value: string): string {
  const hasControl = (text: string) =>
    /[\u0000-\u001f\u007f-\u009f]/.test(text) ||
    Array.from(text).some(char => {
      const point = char.codePointAt(0);
      return point >= 0xd800 && point <= 0xdfff;
    });
  if (typeof value !== 'string' || hasControl(value)) throw new Error('분류 이름에 제어문자를 사용할 수 없습니다.');
  const name = value.normalize('NFKC').trim();
  if (!name || name.length > 80 || hasControl(name)) throw new Error('분류 이름은 제어문자 없이 1~80자로 입력하세요.');
  return name;
}
const entry = (v: any): v is Classification => {
  try {
    return (
      keys(v, ['id', 'name', 'active', 'version']) &&
      id(v.id) &&
      version(v.version) &&
      typeof v.active === 'boolean' &&
      typeof v.name === 'string' &&
      classificationName(v.name) === v.name
    );
  } catch {
    return false;
  }
};
const invalid = () => {
  throw new Error('분류 응답을 확인하지 못했습니다. 입력과 미확정 요청을 보존했습니다.');
};
export function classificationSession() {
  return editorDraftSessionEpoch();
}
export async function listClassifications(afterId?: number): Promise<ClassificationPage> {
  if (afterId !== undefined && !id(afterId)) return invalid();
  const { data } = await get('/enterprise/classifications', afterId === undefined ? undefined : { afterId });
  if (
    !keys(data, ['actorId', 'organizationId', 'canManage', 'entries', 'nextAfterId']) ||
    !id(data.actorId) ||
    !id(data.organizationId) ||
    typeof data.canManage !== 'boolean' ||
    !Array.isArray(data.entries) ||
    data.entries.length > 20 ||
    !data.entries.every((e, i) => entry(e) && e.id > (i ? data.entries[i - 1].id : afterId ?? 0)) ||
    !(data.nextAfterId === null || (id(data.nextAfterId) && data.nextAfterId === data.entries.at(-1)?.id))
  )
    return invalid();
  return data;
}
export async function createClassification(body: ClassificationCreate) {
  if (
    !id(body.expectedActorId) ||
    !id(body.expectedOrganizationId) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId) ||
    classificationName(body.name) !== body.name
  )
    return invalid();
  const { data } = await post('/enterprise/classifications', body);
  if (
    !keys(data, ['actorId', 'organizationId', 'entry', 'replayed']) ||
    data.actorId !== body.expectedActorId ||
    data.organizationId !== body.expectedOrganizationId ||
    typeof data.replayed !== 'boolean' ||
    !entry(data.entry) ||
    data.entry.name !== body.name ||
    !data.entry.active ||
    data.entry.version !== 1
  )
    return invalid();
  return data as { actorId: number; organizationId: number; entry: Classification; replayed: boolean };
}
export async function updateClassification(classificationId: number, body: ClassificationUpdate) {
  if (
    !id(classificationId) ||
    !id(body.expectedActorId) ||
    !id(body.expectedOrganizationId) ||
    !version(body.expectedVersion) ||
    typeof body.active !== 'boolean' ||
    classificationName(body.name) !== body.name
  )
    return invalid();
  const { data } = await post(`/enterprise/classifications/${classificationId}`, body);
  if (
    !keys(data, ['actorId', 'organizationId', 'entry']) ||
    data.actorId !== body.expectedActorId ||
    data.organizationId !== body.expectedOrganizationId ||
    !entry(data.entry) ||
    data.entry.id !== classificationId ||
    data.entry.name !== body.name ||
    data.entry.active !== body.active ||
    ![body.expectedVersion, body.expectedVersion + 1].includes(data.entry.version)
  )
    return invalid();
  return data as { actorId: number; organizationId: number; entry: Classification };
}
export function classificationError(cause: any) {
  return cause?.response?.status === 409
    ? '분류 기준이 변경됐습니다. 입력을 보존했습니다. 목록을 다시 읽고 검토하세요.'
    : cause?.response?.status === 403
    ? '현재 조직의 분류 권한을 확인할 수 없습니다. 입력은 보존됩니다.'
    : cause instanceof Error
    ? cause.message
    : '분류 요청을 확인하지 못했습니다. 입력과 미확정 요청을 보존했습니다.';
}
