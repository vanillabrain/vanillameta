// UC051 resource-grant boundary. The /enterprise/resources endpoints answer with the raw payload, not the legacy
// SUCCESS envelope, so nothing here unwraps `status`/`data`. Actor, owner and organization stay server-side.
import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, MAX_USER_ID_LENGTH, rawPayload } from '@/api/enterpriseService';

export type ResourceKind = 'source' | 'dashboard';

/** The four independent booleans of one grant; edit/publish/export require read and only a dashboard publishes. */
export type ResourceRights = { read: boolean; edit: boolean; publish: boolean; export: boolean };

export type ResourcePolicyResource = { kind: ResourceKind; id: number; label: string };

export type ResourcePolicyEntry = {
  /** Internal positive id of the recipient account; never a login string. */
  recipientId: number;
  /** Login identifier kept verbatim from the server. */
  userId: string;
  version: number;
  rights: ResourceRights;
};

export type ResourcePolicyPage = { entries: ResourcePolicyResource[]; nextAfter: string | null };

export type ResourcePolicyList = { kind: ResourceKind; resourceId: number; entries: ResourcePolicyEntry[] };

export type ResourcePolicyWriteInput = { recipientId: number; expectedVersion: number; rights: ResourceRights };

export type ResourcePolicyWrite = {
  kind: ResourceKind;
  resourceId: number;
  recipientId: number;
  /** 1 or more once a write has landed; a brand-new grant is requested with expectedVersion 0. */
  version: number;
  rights: ResourceRights;
};

/** The cursor is `kind:id`, paged in fixed kind/id order (dashboards before sources). */
export const RESOURCE_CURSOR_PATTERN = /^(?:dashboard|source):[1-9][0-9]{0,18}$/;
export const MAX_RESOURCE_LABEL_LENGTH = 300;

export const isResourceCursor = (value: unknown): value is string =>
  typeof value === 'string' && RESOURCE_CURSOR_PATTERN.test(value);

const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

const kindShape = (value: unknown): value is ResourceKind => value === 'source' || value === 'dashboard';

const rightsShape = (value: any): value is ResourceRights =>
  !!value &&
  typeof value === 'object' &&
  typeof value.read === 'boolean' &&
  typeof value.edit === 'boolean' &&
  typeof value.publish === 'boolean' &&
  typeof value.export === 'boolean';

const resourceShape = (value: any): value is ResourcePolicyResource =>
  !!value &&
  typeof value === 'object' &&
  kindShape(value.kind) &&
  positiveInteger(value.id) &&
  typeof value.label === 'string' &&
  value.label.length <= MAX_RESOURCE_LABEL_LENGTH;

const pageShape = (input: any): input is ResourcePolicyPage =>
  !!input &&
  typeof input === 'object' &&
  Array.isArray(input.entries) &&
  input.entries.every(resourceShape) &&
  (input.nextAfter === null || isResourceCursor(input.nextAfter));

const entryShape = (value: any): value is ResourcePolicyEntry =>
  !!value &&
  typeof value === 'object' &&
  positiveInteger(value.recipientId) &&
  typeof value.userId === 'string' &&
  value.userId.length > 0 &&
  value.userId.length <= MAX_USER_ID_LENGTH &&
  Number.isSafeInteger(value.version) &&
  value.version >= 0 &&
  rightsShape(value.rights);

const listShape =
  (kind: ResourceKind, resourceId: number) =>
  (input: any): input is ResourcePolicyList =>
    !!input &&
    typeof input === 'object' &&
    input.kind === kind &&
    input.resourceId === resourceId &&
    Array.isArray(input.entries) &&
    input.entries.every(entryShape);

/** The answer is the receipt for this exact target; a mismatched payload is never applied as a saved grant. */
const writeShape =
  (kind: ResourceKind, resourceId: number, recipientId: number) =>
  (input: any): input is ResourcePolicyWrite =>
    !!input &&
    typeof input === 'object' &&
    input.kind === kind &&
    input.resourceId === resourceId &&
    input.recipientId === recipientId &&
    Number.isSafeInteger(input.version) &&
    input.version >= 1 &&
    rightsShape(input.rights);

const reasonFrom = (body: any): string | undefined => {
  const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const data = body?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (Array.isArray(data)) return data.join(' · ');
  return undefined;
};

/** Same taxonomy as the organization endpoints, with copy that names the resource grant. */
export const resourcePolicyError = (error: unknown): EnterpriseApiError => {
  if (error instanceof EnterpriseApiError) return error;
  const status = (error as { response?: { status?: number } })?.response?.status;
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  const reason = reasonFrom(body);
  if (status === 401) return new EnterpriseApiError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 'auth', status);
  if (status === 403)
    return new EnterpriseApiError(
      reason ?? '이 자원의 권한을 관리할 권한이 없습니다. 본인이 소유한 자원만 권한을 관리할 수 있습니다.',
      'forbidden',
      status,
    );
  if (status === 409)
    return new EnterpriseApiError(
      '자원 권한이 다른 곳에서 먼저 변경되었습니다. 최신 정책을 다시 불러온 뒤 다시 저장해 주세요.',
      'conflict',
      status,
    );
  if (status === 400 || status === 422)
    return new EnterpriseApiError(reason ?? '권한 요청을 다시 확인해 주세요.', 'invalid', status);
  if (status === undefined)
    return new EnterpriseApiError(
      '서버와 통신하지 못했습니다. 입력한 권한을 그대로 두고 다시 시도해 주세요.',
      'network',
      null,
    );
  return new EnterpriseApiError(reason ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'invalid', status);
};

/** 20+1 fixed order, no SQL or connection metadata. */
export const fetchResourcePolicyResources = (
  after?: string,
  config: Record<string, unknown> = {},
): Promise<ResourcePolicyPage> =>
  get('/enterprise/resources', after === undefined ? {} : { after }, config).then(response =>
    rawPayload<ResourcePolicyPage>(response, pageShape),
  );

/** Stored grants of one owned resource; the reader is the owning admin of the same organization. */
export const fetchResourcePolicies = (
  kind: ResourceKind,
  resourceId: number,
  config: Record<string, unknown> = {},
): Promise<ResourcePolicyList> =>
  get(`/enterprise/resources/${kind}/${resourceId}/policies`, undefined, config).then(response =>
    rawPayload<ResourcePolicyList>(response, listShape(kind, resourceId)),
  );

/** The body carries exactly recipientId/expectedVersion/rights; 0 starts a new grant, then the current version CAS. */
export const saveResourcePolicy = (
  kind: ResourceKind,
  resourceId: number,
  input: ResourcePolicyWriteInput,
  config: Record<string, unknown> = {},
): Promise<ResourcePolicyWrite> =>
  post(
    `/enterprise/resources/${kind}/${resourceId}/policies`,
    {
      recipientId: input.recipientId,
      expectedVersion: input.expectedVersion,
      rights: {
        read: input.rights.read,
        edit: input.rights.edit,
        publish: input.rights.publish,
        export: input.rights.export,
      },
    },
    config,
  ).then(response => rawPayload<ResourcePolicyWrite>(response, writeShape(kind, resourceId, input.recipientId)));
