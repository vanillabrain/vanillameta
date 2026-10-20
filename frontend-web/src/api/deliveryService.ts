import { get, post } from '@/helpers/apiHelper';
export type DeliveryEntry = { recipientId: number; version: number; active: boolean; allowCopy?: boolean };
export type DeliveryInput = {
  requestId: string;
  active: boolean;
  allowCopy?: boolean;
  recipients: Array<{ recipientId: number; expectedVersion: number }>;
};
const exactKeys = (v: unknown, keys: string[]) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every(k => Object.prototype.hasOwnProperty.call(v, k));
export const validDeliveryInput = (v: any): v is DeliveryInput =>
  exactKeys(
    v,
    v?.allowCopy === undefined ? ['requestId', 'active', 'recipients'] : ['requestId', 'active', 'allowCopy', 'recipients'],
  ) &&
  typeof v.requestId === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.requestId) &&
  typeof v.active === 'boolean' &&
  (v.allowCopy === undefined || typeof v.allowCopy === 'boolean') &&
  !(v.active === false && v.allowCopy === true) &&
  Array.isArray(v.recipients) &&
  v.recipients.length >= 1 &&
  v.recipients.length <= 50 &&
  v.recipients.every(
    (r: any) =>
      exactKeys(r, ['recipientId', 'expectedVersion']) &&
      Number.isSafeInteger(r.recipientId) &&
      r.recipientId > 0 &&
      Number.isSafeInteger(r.expectedVersion) &&
      r.expectedVersion >= 0 &&
      r.expectedVersion < 2147483647,
  ) &&
  new Set(v.recipients.map((r: any) => r.recipientId)).size === v.recipients.length;
const entriesShape = (rows: any): rows is DeliveryEntry[] =>
  Array.isArray(rows) &&
  rows.every(
    (row: any, index: number) =>
      !!row &&
      Number.isSafeInteger(row.recipientId) &&
      row.recipientId > 0 &&
      Number.isSafeInteger(row.version) &&
      row.version >= 0 &&
      typeof row.active === 'boolean' &&
      (row.allowCopy === undefined || typeof row.allowCopy === 'boolean') &&
      (index === 0 || row.recipientId > rows[index - 1].recipientId),
  );
export const fetchDeliveries = async (id: number): Promise<DeliveryEntry[]> => {
  const { data } = await get(`/enterprise/deliveries/dashboard/${id}`, {});
  if (!data || data.dashboardId !== id || !entriesShape(data.entries)) throw new Error('공유 응답을 확인할 수 없습니다.');
  return data.entries;
};
export const saveDeliveries = async (
  id: number,
  input: DeliveryInput,
): Promise<{ entries: DeliveryEntry[]; replayed: boolean }> => {
  if (!Number.isSafeInteger(id) || id <= 0 || !validDeliveryInput(input))
    throw new Error('공유 요청의 번호·대상·버전을 확인해 주세요.');
  const { data } = await post(`/enterprise/deliveries/dashboard/${id}`, input);
  const expected = input.recipients.map(entry => entry.recipientId).sort((a, b) => a - b);
  if (
    !data ||
    data.requestId !== input.requestId ||
    data.dashboardId !== id ||
    !entriesShape(data.entries) ||
    data.entries.length !== expected.length ||
    data.entries.some(
      (entry: DeliveryEntry, index: number) =>
        entry.recipientId !== expected[index] ||
        entry.active !== input.active ||
        (input.allowCopy !== undefined && entry.allowCopy !== input.allowCopy),
    ) ||
    typeof data.replayed !== 'boolean'
  )
    throw new Error('공유 결과를 확인할 수 없습니다. 같은 요청으로 다시 확인해 주세요.');
  return data;
};

export type ReceivedDashboard = { dashboardId: number; title: string; version: number; allowCopy?: boolean };
export type ReceivedPage = { entries: ReceivedDashboard[]; nextAfterId: number | null };
export const fetchReceivedDashboards = async (afterId?: number): Promise<ReceivedPage> => {
  const { data } = await get('/enterprise/deliveries/dashboard/received', afterId === undefined ? {} : { afterId });
  const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
  if (
    !data ||
    !Array.isArray(data.entries) ||
    data.entries.length > 20 ||
    !(data.nextAfterId === null || (positive(data.nextAfterId) && data.nextAfterId > (afterId ?? 0))) ||
    !data.entries.every(
      (entry: any, index: number) =>
        !!entry &&
        positive(entry.dashboardId) &&
        entry.dashboardId > (afterId ?? 0) &&
        (index === 0 || entry.dashboardId > data.entries[index - 1].dashboardId) &&
        (data.nextAfterId === null || entry.dashboardId <= data.nextAfterId) &&
        typeof entry.title === 'string' &&
        entry.title.length <= 300 &&
        positive(entry.version) &&
        (entry.allowCopy === undefined || typeof entry.allowCopy === 'boolean'),
    )
  )
    throw new Error('받은 자료 응답을 확인할 수 없습니다.');
  return data;
};
