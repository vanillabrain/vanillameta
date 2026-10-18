// UC050 source availability boundary. The lifecycle endpoints answer with the raw payload, not the legacy
// SUCCESS envelope, so nothing here unwraps `status`/`data`. The actor, owner and organization stay server-side;
// the write body carries exactly the target availability and the version the client read.
import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, rawPayload } from '@/api/enterpriseService';

/** Availability of one owned source. It never carries SQL, connection metadata, analysis or publication content. */
export type SourceLifecycle = {
  sourceId: number;
  /** false refuses new reads through this source until it is activated again; nothing already stored is deleted. */
  active: boolean;
  /** 0 until the first explicit change; every change (even to the same value) answers with +1. */
  version: number;
};

export type SourceLifecycleWriteInput = { active: boolean; expectedVersion: number };

/** Same path for the explicit read and the explicit write; only the owning admin of the same organization passes. */
export const sourceLifecyclePath = (sourceId: number) => `/enterprise/resources/source/${sourceId}/lifecycle`;

/** A read only ever applies to the source that was asked for, at whatever version the server reports. */
const readShape =
  (sourceId: number) =>
  (input: any): input is SourceLifecycle =>
    !!input &&
    typeof input === 'object' &&
    input.sourceId === sourceId &&
    typeof input.active === 'boolean' &&
    Number.isSafeInteger(input.version) &&
    input.version >= 0;

/** A write receipt must describe this exact request: same source, the requested state and version+1. */
const writeShape =
  (sourceId: number, input: SourceLifecycleWriteInput) =>
  (value: any): value is SourceLifecycle =>
    !!value &&
    typeof value === 'object' &&
    value.sourceId === sourceId &&
    value.active === input.active &&
    value.version === input.expectedVersion + 1;

const reasonFrom = (body: any): string | undefined => {
  const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const data = body?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (Array.isArray(data)) return data.join(' · ');
  return undefined;
};

/** Same taxonomy as the grant endpoints, with copy that names the source availability. */
export const sourceLifecycleError = (error: unknown): EnterpriseApiError => {
  if (error instanceof EnterpriseApiError) return error;
  const status = (error as { response?: { status?: number } })?.response?.status;
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  const reason = reasonFrom(body);
  if (status === 401) return new EnterpriseApiError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 'auth', status);
  if (status === 403)
    return new EnterpriseApiError(
      reason ?? '이 소스의 활성 상태를 관리할 권한이 없습니다. 본인이 소유한 소스만 전환할 수 있습니다.',
      'forbidden',
      status,
    );
  if (status === 409)
    return new EnterpriseApiError(
      '소스 상태가 다른 곳에서 먼저 변경되었습니다. 최신 상태를 다시 읽은 뒤 다시 저장해 주세요.',
      'conflict',
      status,
    );
  if (status === 400 || status === 422)
    return new EnterpriseApiError(reason ?? '소스 상태와 현재 버전을 다시 확인해 주세요.', 'invalid', status);
  if (status === undefined)
    return new EnterpriseApiError(
      '서버와 통신하지 못했습니다. 선택한 상태는 그대로 두었습니다. 최신 상태를 다시 읽은 뒤 다시 시도해 주세요.',
      'network',
      null,
    );
  return new EnterpriseApiError(reason ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'invalid', status);
};

/** Explicit read of the current availability, with the version a later write must match. */
export const fetchSourceLifecycle = (sourceId: number, config: Record<string, unknown> = {}): Promise<SourceLifecycle> =>
  get(sourceLifecyclePath(sourceId), undefined, config).then(response =>
    rawPayload<SourceLifecycle>(response, readShape(sourceId)),
  );

/** The body carries exactly active/expectedVersion; the receipt is the same fields with version advanced by one. */
export const saveSourceLifecycle = (
  sourceId: number,
  input: SourceLifecycleWriteInput,
  config: Record<string, unknown> = {},
): Promise<SourceLifecycle> =>
  post(sourceLifecyclePath(sourceId), { active: input.active, expectedVersion: input.expectedVersion }, config).then(
    response => rawPayload<SourceLifecycle>(response, writeShape(sourceId, input)),
  );
