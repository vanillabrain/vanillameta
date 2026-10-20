import { del, get, post } from '@/helpers/apiHelper';
import { EnterpriseApiError, enterpriseError, rawPayload, isEnrollmentCode } from './enterpriseService';

export type StaffTransferStatus = {
  sourceOrganizationId: number;
  targetOrganizationId: number;
  team: string;
  accepted: boolean;
  expiresAt: string;
  status: 'pending' | 'completed';
};
export type StaffTransferCode = {
  code: string;
  expiresAt: string;
  sourceOrganizationId: number;
  targetOrganizationId: number;
};
export type StaffTransferAcceptance = Omit<StaffTransferCode, 'code'> & { accepted: true; team: string };
export type StaffTransferCompletion = {
  completed: true;
  sourceOrganizationId: number;
  targetOrganizationId: number;
  userId: number;
};
const id = (n: unknown) => Number.isSafeInteger(n) && (n as number) > 0;
const reviewBasis = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const version = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const pair = (p: any) =>
  p && id(p.sourceOrganizationId) && id(p.targetOrganizationId) && p.sourceOrganizationId !== p.targetOrganizationId;
const expiry = (p: any) => typeof p.expiresAt === 'string' && Number.isFinite(Date.parse(p.expiresAt));
const team = (s: unknown) => typeof s === 'string' && s.length <= 100;
const request = async <T>(send: () => Promise<{ data?: unknown }>, shape: (p: any) => p is T): Promise<T> => {
  try {
    return rawPayload(await send(), shape);
  } catch (error) {
    throw enterpriseError(error);
  }
};
const requireInput = (valid: boolean) => {
  if (!valid) throw new EnterpriseApiError('조직 번호·코드·팀·조직 버전을 확인해 주세요.', 'invalid');
};
export const fetchStaffTransfer = (): Promise<StaffTransferStatus | null> =>
  request(
    () => get('/enterprise/staff-transfer'),
    (p): p is StaffTransferStatus | null =>
      p === null ||
      (pair(p) &&
        expiry(p) &&
        team(p.team) &&
        typeof p.accepted === 'boolean' &&
        ['pending', 'completed'].includes(p.status) &&
        !('code' in p) &&
        !('hash' in p)),
  );
export const createStaffTransfer = async (targetOrganizationId: number): Promise<StaffTransferCode> => {
  requireInput(id(targetOrganizationId));
  return request(
    () => post('/enterprise/staff-transfer', { targetOrganizationId }),
    (p): p is StaffTransferCode => pair(p) && expiry(p) && isEnrollmentCode(p.code),
  );
};
export const revokeStaffTransfer = (): Promise<{ revoked: true }> =>
  request(
    () => del('/enterprise/staff-transfer'),
    (p): p is { revoked: true } => p?.revoked === true,
  );
export const acceptStaffTransfer = async (input: {
  code: string;
  team: string;
  expectedVersion: number;
}): Promise<StaffTransferAcceptance> => {
  requireInput(isEnrollmentCode(input.code) && team(input.team) && version(input.expectedVersion));
  return request(
    () => post('/enterprise/staff-transfer/accept', input),
    (p): p is StaffTransferAcceptance => pair(p) && expiry(p) && team(p.team) && p.accepted === true,
  );
};
export const completeStaffTransfer = async (input: {
  code: string;
  expectedVersion: number;
  targetExpectedVersion: number;
  reviewBasis: string;
}): Promise<StaffTransferCompletion> => {
  requireInput(
    isEnrollmentCode(input.code) &&
      version(input.expectedVersion) &&
      version(input.targetExpectedVersion) &&
      reviewBasis(input.reviewBasis),
  );
  return request(
    () => post('/enterprise/staff-transfer/complete', input),
    (p): p is StaffTransferCompletion => pair(p) && p.completed === true && id(p.userId),
  );
};

export type StaffTransferReview = Omit<StaffTransferStatus, 'status'> & {
  userId: number;
  sourceVersion: number;
  targetVersion: number;
  /** Opaque server acceptance basis; send verbatim with completion, never derive it on the client. */
  reviewBasis: string;
  status: 'pending';
};
/** A code-bound admin read; it never searches the directory or returns the consent secret. */
export const reviewStaffTransfer = async (code: string): Promise<StaffTransferReview> => {
  requireInput(isEnrollmentCode(code));
  return request(
    () => post('/enterprise/staff-transfer/review', { code }),
    (p): p is StaffTransferReview =>
      pair(p) &&
      id(p.userId) &&
      version(p.sourceVersion) &&
      version(p.targetVersion) &&
      reviewBasis(p.reviewBasis) &&
      team(p.team) &&
      expiry(p) &&
      typeof p.accepted === 'boolean' &&
      p.status === 'pending' &&
      !('code' in p) &&
      !('hash' in p),
  );
};
