import { get } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';
import { HandoverAsset, HandoverProposal, HandoverScope, isHandoverId } from './handoverService';

export type HandoverDependencyAsset = HandoverAsset & {
  dependencyStatus: 'covered' | 'missing' | 'unresolved';
  requiredSources: number;
  selectedSources: number;
  missingOwnedSources: number;
  otherSources: number;
  metricCount: number;
  storage: 'not_applicable' | 'file_review_required' | 'connection_review_required' | 'unresolved';
};
export type HandoverDependencyReport = {
  requestId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  proposalVersion: number;
  checkedAt: string;
  scope: 'selected_dependencies_v1';
  executionAvailable: false;
  assets: HandoverDependencyAsset[];
};
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const id = (value: unknown): value is number => nonnegative(value) && value > 0;
const keys = (value: any, expected: readonly string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === expected.length &&
  expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
const assetKeys = [
  'kind',
  'id',
  'title',
  'dependencyStatus',
  'requiredSources',
  'selectedSources',
  'missingOwnedSources',
  'otherSources',
  'metricCount',
  'storage',
];
const counts = ['requiredSources', 'selectedSources', 'missingOwnedSources', 'otherSources', 'metricCount'];

/** This read is bound to the owner's accepted manifest. It never returns an execution ticket. */
export const fetchHandoverDependencyReview = async (
  review: HandoverProposal,
  scope: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<HandoverDependencyReport> => {
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
      throw new EnterpriseApiError('현재 조직의 소유자가 수락·공개 상태의 의향을 다시 확인해 주세요.', 'invalid');
    return rawPayload(
      await get(`/enterprise/handover/${review.requestId}/dependencies`, undefined, config),
      (data: any): data is HandoverDependencyReport =>
        keys(data, [
          'requestId',
          'organizationId',
          'ownerId',
          'recipientId',
          'proposalVersion',
          'checkedAt',
          'scope',
          'executionAvailable',
          'assets',
        ]) &&
        data.requestId === review.requestId &&
        data.organizationId === scope.organizationId &&
        data.ownerId === scope.actorId &&
        data.recipientId === review.recipientId &&
        data.proposalVersion === review.version &&
        typeof data.checkedAt === 'string' &&
        Number.isFinite(Date.parse(data.checkedAt)) &&
        data.scope === 'selected_dependencies_v1' &&
        data.executionAvailable === false &&
        Array.isArray(data.assets) &&
        data.assets.length === review.assets.length &&
        data.assets.every(
          (asset: any, index: number) =>
            keys(asset, assetKeys) &&
            asset.kind === review.assets[index].kind &&
            asset.id === review.assets[index].id &&
            asset.title === review.assets[index].title &&
            ['covered', 'missing', 'unresolved'].includes(asset.dependencyStatus) &&
            counts.every(key => nonnegative(asset[key])) &&
            ['not_applicable', 'file_review_required', 'connection_review_required', 'unresolved'].includes(asset.storage),
        ),
    );
  } catch (cause) {
    throw enterpriseError(cause);
  }
};
