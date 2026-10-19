import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';
import { HandoverProposal, HandoverScope, isHandoverId } from './handoverService';

export type SourceTransferSource = { id: number; title: string; filesChecked: number; metricCount: number };
export const sourceTransferBlockers = [
  'mixed_assets',
  'unsupported_source',
  'source_in_use',
  'active_permissions',
  'running_work',
  'file_unresolved',
  'file_shared',
  'asset_version_limit',
] as const;
export type SourceTransferReview = {
  proposalId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  proposalVersion: number;
  checkedAt: string;
  basis: string;
  eligible: boolean;
  blockers: Array<(typeof sourceTransferBlockers)[number]>;
  sources: SourceTransferSource[];
};
export type SourceTransferRecord = {
  proposalId: string;
  requestId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  version: number;
  status: 'prepared' | 'accepted' | 'completed' | 'cancelled';
  reviewBasis: string;
  expiresAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  detailsAvailable: boolean;
  sources: SourceTransferSource[];
  replayed: boolean;
};
export type SourceTransferPrepare = {
  requestId: string;
  expectedProposalVersion: number;
  basis: string;
  acknowledgedTransfer: true;
};
export const exactSourceTransferKeys = (v: any, fields: string[]) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === fields.length &&
  fields.every(k => Object.prototype.hasOwnProperty.call(v, k));
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
// Opaque server values: the contract does not prescribe a digest encoding.
const opaque = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(v);
const sources = (v: any) =>
  Array.isArray(v) &&
  v.length <= 20 &&
  v.every(
    d =>
      exactSourceTransferKeys(d, ['id', 'title', 'filesChecked', 'metricCount']) &&
      positive(d.id) &&
      typeof d.title === 'string' &&
      d.title.length <= 300 &&
      Number.isSafeInteger(d.filesChecked) &&
      d.filesChecked >= 0 &&
      d.filesChecked <= 5 &&
      Number.isSafeInteger(d.metricCount) &&
      d.metricCount >= 0,
  ) &&
  new Set(v.map(d => d.id)).size === v.length;
const relevant = (v: any, p: HandoverProposal, s: HandoverScope) =>
  isHandoverId(p.requestId) &&
  positive(s.actorId) &&
  positive(s.organizationId) &&
  v.proposalId === p.requestId &&
  v.organizationId === s.organizationId &&
  v.organizationId === p.organizationId &&
  v.ownerId === p.ownerId &&
  v.recipientId === p.recipientId &&
  positive(v.ownerId) &&
  positive(v.recipientId) &&
  v.ownerId !== v.recipientId &&
  [v.ownerId, v.recipientId].includes(s.actorId);
const validScope = (p: HandoverProposal, s: HandoverScope) =>
  isHandoverId(p.requestId) &&
  positive(p.version) &&
  positive(p.organizationId) &&
  positive(p.ownerId) &&
  positive(p.recipientId) &&
  p.ownerId !== p.recipientId &&
  positive(s.actorId) &&
  s.organizationId === p.organizationId &&
  [p.ownerId, p.recipientId].includes(s.actorId);
const manifest = (d: SourceTransferSource[], p: HandoverProposal) =>
  p.detailsAvailable &&
  d.length === p.assets.filter(a => a.kind === 'source').length &&
  d.every(a => p.assets.some(b => b.kind === 'source' && a.id === b.id && a.title === b.title));
const record = (v: any, p: HandoverProposal, s: HandoverScope): v is SourceTransferRecord =>
  exactSourceTransferKeys(v, [
    'proposalId',
    'requestId',
    'organizationId',
    'ownerId',
    'recipientId',
    'version',
    'status',
    'reviewBasis',
    'expiresAt',
    'acceptedAt',
    'completedAt',
    'detailsAvailable',
    'sources',
    'replayed',
  ]) &&
  relevant(v, p, s) &&
  isHandoverId(v.requestId) &&
  positive(v.version) &&
  ['prepared', 'accepted', 'completed', 'cancelled'].includes(v.status) &&
  (v.status === 'prepared'
    ? v.version === 1
    : v.status === 'accepted'
    ? v.version === 2
    : v.status === 'completed'
    ? v.version === 3
    : [2, 3].includes(v.version)) &&
  typeof v.reviewBasis === 'string' &&
  v.reviewBasis.length === 64 &&
  opaque(v.reviewBasis) &&
  date(v.expiresAt) &&
  (v.acceptedAt === null || date(v.acceptedAt)) &&
  (v.completedAt === null || date(v.completedAt)) &&
  (!(v.status === 'accepted' || v.status === 'completed') || v.acceptedAt !== null) &&
  (v.status === 'completed' ? v.completedAt !== null : v.completedAt === null) &&
  (v.status !== 'prepared' || v.acceptedAt === null) &&
  (v.status !== 'cancelled' || (v.version === 2 ? v.acceptedAt === null : v.acceptedAt !== null)) &&
  (v.acceptedAt === null || Date.parse(v.acceptedAt) <= Date.parse(v.expiresAt)) &&
  (v.completedAt === null ||
    (Date.parse(v.completedAt) >= Date.parse(v.acceptedAt) && Date.parse(v.completedAt) <= Date.parse(v.expiresAt))) &&
  typeof v.detailsAvailable === 'boolean' &&
  typeof v.replayed === 'boolean' &&
  sources(v.sources) &&
  (v.detailsAvailable
    ? p.detailsAvailable &&
      !p.expired &&
      p.status !== 'cancelled' &&
      v.sources.length >= 1 &&
      p.assets.every(a => a.kind === 'source') &&
      v.sources.every(a => a.filesChecked >= 1) &&
      manifest(v.sources, p)
    : v.sources.length === 0);
export const validSourceTransferPrepare = (v: any): v is SourceTransferPrepare =>
  exactSourceTransferKeys(v, ['requestId', 'expectedProposalVersion', 'basis', 'acknowledgedTransfer']) &&
  isHandoverId(v.requestId) &&
  positive(v.expectedProposalVersion) &&
  opaque(v.basis) &&
  v.acknowledgedTransfer === true;
const requireInput = (ok: boolean) => {
  if (!ok) throw new EnterpriseApiError('소스 인계의 당사자·목록·검토 기준을 확인해 주세요.', 'invalid');
};
const read = async <T>(send: () => Promise<{ data?: unknown }>, shape: (v: any) => v is T) => {
  try {
    return rawPayload(await send(), shape);
  } catch (e) {
    throw enterpriseError(e);
  }
};
const path = (p: HandoverProposal) => `/enterprise/handover/${p.requestId}/source-transfer`;
export async function fetchSourceTransferReview(
  p: HandoverProposal,
  s: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<SourceTransferReview> {
  requireInput(
    validScope(p, s) &&
      s.actorId === p.ownerId &&
      s.organizationId === p.organizationId &&
      p.status === 'accepted' &&
      p.detailsAvailable &&
      !p.expired &&
      isHandoverId(p.requestId),
  );
  return read(
    () => get(`${path(p)}-review`, undefined, config),
    (v): v is SourceTransferReview =>
      exactSourceTransferKeys(v, [
        'proposalId',
        'organizationId',
        'ownerId',
        'recipientId',
        'proposalVersion',
        'checkedAt',
        'basis',
        'eligible',
        'blockers',
        'sources',
      ]) &&
      relevant(v, p, s) &&
      positive(v.proposalVersion) &&
      v.proposalVersion === p.version &&
      date(v.checkedAt) &&
      opaque(v.basis) &&
      typeof v.eligible === 'boolean' &&
      Array.isArray(v.blockers) &&
      v.blockers.every(b => sourceTransferBlockers.includes(b)) &&
      new Set(v.blockers).size === v.blockers.length &&
      v.eligible === (v.blockers.length === 0) &&
      sources(v.sources) &&
      manifest(v.sources, p) &&
      (!v.eligible ||
        (v.sources.length >= 1 && p.assets.every(a => a.kind === 'source') && v.sources.every(a => a.filesChecked >= 1))),
  );
}
export async function fetchSourceTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<SourceTransferRecord> {
  requireInput(validScope(p, s));
  return read(
    () => get(path(p), undefined, config),
    (v): v is SourceTransferRecord => record(v, p, s),
  );
}
export async function prepareSourceTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  input: SourceTransferPrepare,
): Promise<SourceTransferRecord> {
  requireInput(
    validScope(p, s) &&
      s.actorId === p.ownerId &&
      validSourceTransferPrepare(input) &&
      input.expectedProposalVersion === p.version &&
      s.organizationId === p.organizationId &&
      isHandoverId(p.requestId),
  );
  return read(
    () => post(path(p), input),
    (v): v is SourceTransferRecord => record(v, p, s) && v.requestId === input.requestId,
  );
}
export async function decideSourceTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  r: SourceTransferRecord,
  action: 'accept' | 'execute' | 'cancel',
): Promise<SourceTransferRecord> {
  requireInput(
    validScope(p, s) &&
      record(r, p, s) &&
      (action === 'cancel' || (p.status === 'accepted' && p.detailsAvailable && !p.expired)) &&
      (action === 'accept'
        ? s.actorId === r.recipientId &&
          r.status === 'prepared' &&
          r.detailsAvailable &&
          Date.parse(r.expiresAt) > Date.now()
        : action === 'execute'
        ? s.actorId === r.ownerId && r.status === 'accepted' && r.detailsAvailable && Date.parse(r.expiresAt) > Date.now()
        : action === 'cancel' && s.actorId === r.ownerId && ['prepared', 'accepted'].includes(r.status)),
  );
  return read(
    () =>
      post(`${path(p)}/${action}`, { expectedVersion: r.version, reviewBasis: r.reviewBasis, acknowledgedTransfer: true }),
    (v): v is SourceTransferRecord =>
      record(v, p, s) &&
      v.requestId === r.requestId &&
      v.reviewBasis === r.reviewBasis &&
      v.version >= r.version &&
      (!v.detailsAvailable ||
        !r.detailsAvailable ||
        (v.sources.length === r.sources.length &&
          v.sources.every(item =>
            r.sources.some(
              previous =>
                previous.id === item.id &&
                previous.title === item.title &&
                previous.filesChecked === item.filesChecked &&
                previous.metricCount === item.metricCount,
            ),
          ))) &&
      (action === 'execute'
        ? v.status === 'completed'
        : action === 'cancel'
        ? v.status === 'cancelled'
        : ['accepted', 'completed', 'cancelled'].includes(v.status) && v.acceptedAt !== null),
  );
}
