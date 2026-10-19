import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';

export type HandoverKind = 'source' | 'dashboard';
export type HandoverAsset = { kind: HandoverKind; id: number; title: string };
export type HandoverCandidates = { entries: HandoverAsset[]; nextAfterId: number | null };
export type HandoverScope = { organizationId: number; actorId: number };
export type HandoverCreate = { requestId: string; recipientId: number; assets: HandoverAsset[] };
export type HandoverProposal = {
  requestId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  version: number;
  status: 'pending' | 'accepted' | 'cancelled';
  expiresAt: string;
  acceptedAt: string | null;
  reviewBasis: string;
  assets: HandoverAsset[];
  expired: boolean;
  detailsAvailable: boolean;
};
export const isHandoverId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const basis = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const kindShape = (value: unknown): value is HandoverKind => value === 'source' || value === 'dashboard';
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const keys = (value: any, fields: string[]) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === fields.length &&
  fields.every(key => Object.prototype.hasOwnProperty.call(value, key));
const asset = (value: any): value is HandoverAsset =>
  keys(value, ['kind', 'id', 'title']) &&
  kindShape(value.kind) &&
  id(value.id) &&
  typeof value.title === 'string' &&
  value.title.length <= 300;
const unique = (assets: Array<{ kind: HandoverKind; id: number }>) =>
  new Set(assets.map(item => `${item.kind}:${item.id}`)).size === assets.length;
const validScope = (scope: HandoverScope) => id(scope.organizationId) && id(scope.actorId);
const invalid = () => new EnterpriseApiError('인계 의향의 입력·조직·검토 기준을 확인해 주세요.', 'invalid');
const requireInput = (valid: boolean) => {
  if (!valid) throw invalid();
};
const proposal = (value: any, scope: HandoverScope, requestId: string): value is HandoverProposal =>
  keys(value, [
    'requestId',
    'organizationId',
    'ownerId',
    'recipientId',
    'version',
    'status',
    'expiresAt',
    'acceptedAt',
    'reviewBasis',
    'assets',
    'expired',
    'detailsAvailable',
  ]) &&
  isHandoverId(value.requestId) &&
  value.requestId === requestId &&
  id(value.organizationId) &&
  value.organizationId === scope.organizationId &&
  id(value.ownerId) &&
  id(value.recipientId) &&
  value.ownerId !== value.recipientId &&
  (value.ownerId === scope.actorId || value.recipientId === scope.actorId) &&
  id(value.version) &&
  ['pending', 'accepted', 'cancelled'].includes(value.status) &&
  date(value.expiresAt) &&
  (value.acceptedAt === null || date(value.acceptedAt)) &&
  (value.status !== 'accepted' || value.acceptedAt !== null) &&
  basis(value.reviewBasis) &&
  typeof value.expired === 'boolean' &&
  Array.isArray(value.assets) &&
  typeof value.detailsAvailable === 'boolean' &&
  (!value.detailsAvailable || (!value.expired && value.status !== 'cancelled')) &&
  (value.detailsAvailable ? value.assets.length >= 1 && value.assets.length <= 20 : value.assets.length === 0) &&
  value.assets.every(asset) &&
  unique(value.assets);
const read = async <T>(send: () => Promise<{ data?: unknown }>, shape: (p: any) => p is T): Promise<T> => {
  try {
    return rawPayload(await send(), shape);
  } catch (error) {
    throw enterpriseError(error);
  }
};
export const fetchHandoverCandidates = async (
  kind: HandoverKind,
  afterId?: number,
  config: Record<string, unknown> = {},
): Promise<HandoverCandidates> => {
  requireInput(kindShape(kind) && (afterId === undefined || id(afterId)));
  return read(
    () => get('/enterprise/handover/candidates', { kind, ...(afterId === undefined ? {} : { afterId }) }, config),
    (p): p is HandoverCandidates =>
      keys(p, ['entries', 'nextAfterId']) &&
      Array.isArray(p.entries) &&
      p.entries.length <= 20 &&
      p.entries.every(
        (entry: any, index: number) =>
          asset(entry) &&
          entry.kind === kind &&
          entry.id > (afterId ?? 0) &&
          (index === 0 || entry.id > p.entries[index - 1].id),
      ) &&
      (p.nextAfterId === null ||
        (id(p.nextAfterId) && p.entries.length > 0 && p.nextAfterId === p.entries[p.entries.length - 1].id)),
  );
};
export const fetchHandoverProposal = async (
  requestId: string,
  scope: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<HandoverProposal> => {
  requireInput(isHandoverId(requestId) && validScope(scope));
  return read(
    () => get(`/enterprise/handover/${requestId}`, undefined, config),
    (p): p is HandoverProposal => proposal(p, scope, requestId),
  );
};
export const createHandoverProposal = async (input: HandoverCreate, scope: HandoverScope): Promise<HandoverProposal> => {
  requireInput(
    validScope(scope) &&
      keys(input, ['requestId', 'recipientId', 'assets']) &&
      isHandoverId(input.requestId) &&
      id(input.recipientId) &&
      input.recipientId !== scope.actorId &&
      Array.isArray(input.assets) &&
      input.assets.length >= 1 &&
      input.assets.length <= 20 &&
      input.assets.every(asset) &&
      unique(input.assets),
  );
  return read(
    () => post('/enterprise/handover', input),
    (p): p is HandoverProposal =>
      proposal(p, scope, input.requestId) &&
      p.ownerId === scope.actorId &&
      p.recipientId === input.recipientId &&
      (!p.detailsAvailable ||
        (p.assets.length === input.assets.length &&
          input.assets.every(item =>
            p.assets.some(found => found.kind === item.kind && found.id === item.id && found.title === item.title),
          ))),
  );
};
export const writeHandoverDecision = async (
  review: HandoverProposal,
  action: 'accept' | 'cancel',
  scope: HandoverScope,
): Promise<HandoverProposal> => {
  requireInput(
    validScope(scope) &&
      proposal(review, scope, review.requestId) &&
      (action === 'accept'
        ? review.recipientId === scope.actorId && review.status === 'pending' && !review.expired && review.detailsAvailable
        : action === 'cancel' && review.ownerId === scope.actorId && review.status !== 'cancelled'),
  );
  return read(
    () =>
      post(`/enterprise/handover/${review.requestId}/${action}`, {
        expectedVersion: review.version,
        reviewBasis: review.reviewBasis,
      }),
    (p): p is HandoverProposal =>
      proposal(p, scope, review.requestId) &&
      p.ownerId === review.ownerId &&
      p.recipientId === review.recipientId &&
      (action === 'accept'
        ? (p.status === 'accepted' || p.status === 'cancelled') && p.acceptedAt !== null
        : p.status === 'cancelled') &&
      p.version >= review.version &&
      p.reviewBasis === review.reviewBasis &&
      (!p.detailsAvailable ||
        (p.assets.length === review.assets.length &&
          p.assets.every(
            (item, index) =>
              item.kind === review.assets[index].kind &&
              item.id === review.assets[index].id &&
              item.title === review.assets[index].title,
          ))),
  );
};
