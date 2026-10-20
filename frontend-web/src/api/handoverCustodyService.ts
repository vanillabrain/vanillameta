import { get } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';
import { HandoverProposal, HandoverScope, isHandoverId } from './handoverService';

export type HandoverCustodySource = {
  kind: 'source';
  id: number;
  title: string;
  storage: 'managed_file' | 'external_connection' | 'unresolved';
  identity: 'observed' | 'unresolved' | 'not_applicable';
  filesChecked: number;
  consumers: 'present' | 'none_observed' | 'unresolved' | 'not_applicable';
  refresh: 'active_or_unresolved' | 'none_observed' | 'not_applicable';
};
export type HandoverCustodyReport = {
  requestId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  proposalVersion: number;
  checkedAt: string;
  scope: 'selected_file_custody_v1';
  executionAvailable: false;
  sources: HandoverCustodySource[];
};
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const keys = (value: any, expected: string[]) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === expected.length &&
  expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
const coherentSource = (source: HandoverCustodySource): boolean => {
  if (source.storage === 'external_connection')
    return (
      source.identity === 'not_applicable' &&
      source.consumers === 'not_applicable' &&
      source.refresh === 'not_applicable' &&
      source.filesChecked === 0
    );
  if (source.storage === 'unresolved')
    return (
      source.identity === 'unresolved' &&
      source.consumers === 'unresolved' &&
      source.refresh === 'active_or_unresolved' &&
      source.filesChecked === 0
    );
  return (
    (source.identity === 'observed' || source.identity === 'unresolved') &&
    source.consumers !== 'not_applicable' &&
    source.refresh !== 'not_applicable' &&
    (source.identity !== 'observed' || source.filesChecked >= 1)
  );
};
/** Observations only: no file paths, content proof, exclusive custody proof, or execution ticket. */
export const fetchHandoverFileCustody = async (
  review: HandoverProposal,
  scope: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<HandoverCustodyReport> => {
  try {
    if (
      !isHandoverId(review.requestId) ||
      !id(scope.actorId) ||
      !id(scope.organizationId) ||
      review.ownerId !== scope.actorId ||
      review.organizationId !== scope.organizationId ||
      !id(review.recipientId) ||
      review.recipientId === review.ownerId ||
      !id(review.version) ||
      review.status !== 'accepted' ||
      review.detailsAvailable !== true ||
      review.expired !== false ||
      !Array.isArray(review.assets) ||
      review.assets.length < 1 ||
      review.assets.length > 20 ||
      !review.assets.every(
        asset =>
          (asset.kind === 'source' || asset.kind === 'dashboard') &&
          id(asset.id) &&
          typeof asset.title === 'string' &&
          asset.title.length <= 300,
      ) ||
      new Set(review.assets.map(asset => `${asset.kind}:${asset.id}`)).size !== review.assets.length
    )
      throw new EnterpriseApiError('현재 조직 소유자의 수락·공개 상태 의향을 다시 확인해 주세요.', 'invalid');
    const sources = review.assets.filter(asset => asset.kind === 'source');
    return rawPayload(
      await get(`/enterprise/handover/${review.requestId}/custody`, undefined, config),
      (data: any): data is HandoverCustodyReport =>
        keys(data, [
          'requestId',
          'organizationId',
          'ownerId',
          'recipientId',
          'proposalVersion',
          'checkedAt',
          'scope',
          'executionAvailable',
          'sources',
        ]) &&
        data.requestId === review.requestId &&
        data.organizationId === scope.organizationId &&
        data.ownerId === scope.actorId &&
        data.recipientId === review.recipientId &&
        data.proposalVersion === review.version &&
        typeof data.checkedAt === 'string' &&
        Number.isFinite(Date.parse(data.checkedAt)) &&
        data.scope === 'selected_file_custody_v1' &&
        data.executionAvailable === false &&
        Array.isArray(data.sources) &&
        data.sources.length === sources.length &&
        data.sources.every(
          (source: any, index: number) =>
            keys(source, ['kind', 'id', 'title', 'storage', 'identity', 'filesChecked', 'consumers', 'refresh']) &&
            source.kind === 'source' &&
            source.id === sources[index].id &&
            source.title === sources[index].title &&
            ['managed_file', 'external_connection', 'unresolved'].includes(source.storage) &&
            ['observed', 'unresolved', 'not_applicable'].includes(source.identity) &&
            Number.isSafeInteger(source.filesChecked) &&
            source.filesChecked >= 0 &&
            source.filesChecked <= 5 &&
            ['present', 'none_observed', 'unresolved', 'not_applicable'].includes(source.consumers) &&
            ['active_or_unresolved', 'none_observed', 'not_applicable'].includes(source.refresh) &&
            coherentSource(source),
        ),
    );
  } catch (cause) {
    throw enterpriseError(cause);
  }
};
