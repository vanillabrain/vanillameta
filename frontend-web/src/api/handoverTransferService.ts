import { get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload } from './enterpriseService';
import { HandoverProposal, HandoverScope, isHandoverId } from './handoverService';

export type TransferDashboard = { id: number; title: string };
export const transferBlockers = [
  'source_transfer_deferred',
  'recipient_source_ownership_required',
  'shared_dashboard',
  'unsupported_definition',
  'running_work',
  'stale_studio',
  'governed_dashboard',
  'unsupported_widget',
  'asset_version_limit',
] as const;
export type TransferReview = {
  proposalId: string;
  organizationId: number;
  ownerId: number;
  recipientId: number;
  proposalVersion: number;
  checkedAt: string;
  basis: string;
  eligible: boolean;
  blockers: Array<(typeof transferBlockers)[number]>;
  dashboards: TransferDashboard[];
};
export type TransferRecord = {
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
  dashboards: TransferDashboard[];
  replayed: boolean;
};
export type TransferPrepare = {
  requestId: string;
  expectedProposalVersion: number;
  basis: string;
  acknowledgedTransfer: true;
};
export const exactTransferKeys = (v: any, fields: string[]) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === fields.length &&
  fields.every(k => Object.prototype.hasOwnProperty.call(v, k));
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
// Opaque server values: the contract does not prescribe a digest encoding.
const opaque = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(v);
const dashboards = (v: any) =>
  Array.isArray(v) &&
  v.length <= 20 &&
  v.every(
    d => exactTransferKeys(d, ['id', 'title']) && positive(d.id) && typeof d.title === 'string' && d.title.length <= 300,
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
const manifest = (d: TransferDashboard[], p: HandoverProposal) =>
  p.detailsAvailable &&
  d.length === p.assets.filter(a => a.kind === 'dashboard').length &&
  d.every(a => p.assets.some(b => b.kind === 'dashboard' && a.id === b.id && a.title === b.title));
const record = (v: any, p: HandoverProposal, s: HandoverScope): v is TransferRecord =>
  exactTransferKeys(v, [
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
    'dashboards',
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
  opaque(v.reviewBasis) &&
  date(v.expiresAt) &&
  (v.acceptedAt === null || date(v.acceptedAt)) &&
  (v.completedAt === null || date(v.completedAt)) &&
  (!(v.status === 'accepted' || v.status === 'completed') || v.acceptedAt !== null) &&
  (v.status === 'completed' ? v.completedAt !== null : v.completedAt === null) &&
  typeof v.detailsAvailable === 'boolean' &&
  typeof v.replayed === 'boolean' &&
  dashboards(v.dashboards) &&
  (v.detailsAvailable
    ? p.detailsAvailable && !p.expired && p.status !== 'cancelled' && v.dashboards.length >= 1 && manifest(v.dashboards, p)
    : v.dashboards.length === 0);
export const validTransferPrepare = (v: any): v is TransferPrepare =>
  exactTransferKeys(v, ['requestId', 'expectedProposalVersion', 'basis', 'acknowledgedTransfer']) &&
  isHandoverId(v.requestId) &&
  positive(v.expectedProposalVersion) &&
  opaque(v.basis) &&
  v.acknowledgedTransfer === true;
const requireInput = (ok: boolean) => {
  if (!ok) throw new EnterpriseApiError('최종 인계의 당사자·목록·검토 기준을 확인해 주세요.', 'invalid');
};
const read = async <T>(send: () => Promise<{ data?: unknown }>, shape: (v: any) => v is T) => {
  try {
    return rawPayload(await send(), shape);
  } catch (e) {
    throw enterpriseError(e);
  }
};
const path = (p: HandoverProposal) => `/enterprise/handover/${p.requestId}/transfer`;
export async function fetchTransferReview(
  p: HandoverProposal,
  s: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<TransferReview> {
  requireInput(
    s.actorId === p.ownerId &&
      s.organizationId === p.organizationId &&
      p.status === 'accepted' &&
      p.detailsAvailable &&
      !p.expired &&
      isHandoverId(p.requestId),
  );
  return read(
    () => get(`${path(p)}-review`, undefined, config),
    (v): v is TransferReview =>
      exactTransferKeys(v, [
        'proposalId',
        'organizationId',
        'ownerId',
        'recipientId',
        'proposalVersion',
        'checkedAt',
        'basis',
        'eligible',
        'blockers',
        'dashboards',
      ]) &&
      relevant(v, p, s) &&
      v.proposalVersion === p.version &&
      date(v.checkedAt) &&
      opaque(v.basis) &&
      typeof v.eligible === 'boolean' &&
      Array.isArray(v.blockers) &&
      v.blockers.every(b => transferBlockers.includes(b)) &&
      new Set(v.blockers).size === v.blockers.length &&
      v.eligible === (v.blockers.length === 0) &&
      dashboards(v.dashboards) &&
      manifest(v.dashboards, p) &&
      (!v.eligible || (v.dashboards.length >= 1 && p.assets.every(a => a.kind === 'dashboard'))),
  );
}
export async function fetchTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  config: Record<string, unknown> = {},
): Promise<TransferRecord> {
  requireInput(
    isHandoverId(p.requestId) && s.organizationId === p.organizationId && [p.ownerId, p.recipientId].includes(s.actorId),
  );
  return read(
    () => get(path(p), undefined, config),
    (v): v is TransferRecord => record(v, p, s),
  );
}
export async function prepareTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  input: TransferPrepare,
): Promise<TransferRecord> {
  requireInput(
    s.actorId === p.ownerId &&
      validTransferPrepare(input) &&
      input.expectedProposalVersion === p.version &&
      s.organizationId === p.organizationId &&
      isHandoverId(p.requestId),
  );
  return read(
    () => post(path(p), input),
    (v): v is TransferRecord => record(v, p, s) && v.requestId === input.requestId,
  );
}
export async function decideTransfer(
  p: HandoverProposal,
  s: HandoverScope,
  r: TransferRecord,
  action: 'accept' | 'execute' | 'cancel',
): Promise<TransferRecord> {
  requireInput(
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
    (v): v is TransferRecord =>
      record(v, p, s) &&
      v.requestId === r.requestId &&
      v.reviewBasis === r.reviewBasis &&
      v.version >= r.version &&
      (action === 'execute'
        ? v.status === 'completed'
        : action === 'cancel'
        ? v.status === 'cancelled'
        : ['accepted', 'completed', 'cancelled'].includes(v.status) && v.acceptedAt !== null),
  );
}
