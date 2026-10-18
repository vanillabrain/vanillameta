import { get } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';

export const DEPARTURE_COUNT_KEYS = [
  'sources',
  'metrics',
  'soleDashboards',
  'ambiguousDashboards',
  'directGrants',
  'personalDeliveries',
  'groupMemberships',
  'ownedGroupGrants',
  'ownedGroupDeliveries',
  'publications',
  'exportJobs',
] as const;
export type DepartureCountKey = (typeof DEPARTURE_COUNT_KEYS)[number];
export type DepartureScope = { organizationId: number; organizationVersion: number; targetId: number };
export type StaffDepartureImpact = DepartureScope & {
  targetActive: boolean;
  observedAt: string;
  counts: Record<DepartureCountKey, number>;
};
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
const exactKeys = (value: unknown, keys: readonly string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.prototype.hasOwnProperty.call(value, key));

/** Only this explicit read is available: no directory lookup, content read, or mutation. */
export const fetchStaffDepartureImpact = async (
  scope: DepartureScope,
  config: Record<string, unknown> = {},
): Promise<StaffDepartureImpact> => {
  try {
    if (!positive(scope.organizationId) || !positive(scope.targetId) || !nonnegative(scope.organizationVersion))
      throw new EnterpriseApiError('현재 조직과 직원 번호·버전을 다시 확인해 주세요.', 'invalid');
    return rawPayload(
      await get(`/enterprise/members/${scope.targetId}/departure-impact`, undefined, config),
      (data: any): data is StaffDepartureImpact =>
        exactKeys(data, ['organizationId', 'organizationVersion', 'targetId', 'targetActive', 'observedAt', 'counts']) &&
        positive(data.organizationId) &&
        data.organizationId === scope.organizationId &&
        nonnegative(data.organizationVersion) &&
        data.organizationVersion === scope.organizationVersion &&
        positive(data.targetId) &&
        data.targetId === scope.targetId &&
        typeof data.targetActive === 'boolean' &&
        typeof data.observedAt === 'string' &&
        Number.isFinite(Date.parse(data.observedAt)) &&
        exactKeys(data.counts, DEPARTURE_COUNT_KEYS) &&
        DEPARTURE_COUNT_KEYS.every(key => nonnegative(data.counts[key])),
    );
  } catch (error) {
    throw enterpriseError(error);
  }
};
