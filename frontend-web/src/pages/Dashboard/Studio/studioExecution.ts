import { CreationProposal, validateCreationProposal } from './studioCreation';
import type { RemixSaveInput } from './studioRemixApi';
import { get, post } from '@/helpers/apiHelper';
import { studioAssert, studioKeys, validateStudioDocument } from './studioDocument';
import { toStudioApiError, StudioSaveResult } from './studioApi';
import type { StudioRunContext, StudioRunResult } from './studioRunTransport';
import { Publication, validatePublication } from './studioPublication';
export const STEP_LABELS = {
  inspectSource: '데이터 확인',
  createProposal: '새 지표·차원과 계산 제안',
  proposeSemantics: 'AI 제안',
  preview: '계산 검증',
  applyDraft: '초안 준비',
  saveDraft: '대시보드 저장',
  publish: '공유',
  remix: '복제 준비',
} as const;
export const STATUS_LABELS = {
  pending: '대기',
  running: '실행 중',
  succeeded: '완료',
  completed: '완료',
  failed: '실패',
  cancelled: '중지됨',
  interrupted: '실행 중단',
  unsupported: '지원 예정',
  partial: '부분 완료',
  skipped: '미실행',
} as const;
export type ExecutionStatus = keyof typeof STATUS_LABELS;
export type ExecutionStep = {
  stepId: keyof typeof STEP_LABELS;
  status: ExecutionStatus;
  retryable: boolean;
  errorCode?: string;
  resultRef?: string;
};
export type ExecutionRequest = StudioRunContext & { requestId: string; prompt: string };
/** Historical publication receipt. Access is checked again by the published viewer. */
export type StudioPublicationResult = Publication;
export function validatePublicationResult(input: unknown): StudioPublicationResult {
  studioKeys(input, [
    'token',
    'version',
    'visibility',
    'allowRemix',
    'expiresAt',
    'asOf',
    'dataVersion',
    'dashboardId',
    'revokedAt',
  ]);
  const value = validatePublication(input);
  const timestamp = (date: unknown): date is string =>
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 19) === date.slice(0, 19);
  studioAssert(
    typeof value.token === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value.token),
    '게시 링크를 확인하지 못했습니다.',
  );
  studioAssert(Number.isSafeInteger(value.version) && value.version > 0, '게시 버전을 확인하지 못했습니다.');
  studioAssert(['private', 'link'].includes(value.visibility), '게시 접근 범위를 확인하지 못했습니다.');
  studioAssert(typeof value.allowRemix === 'boolean', '게시 복제 설정을 확인하지 못했습니다.');
  studioAssert(timestamp(value.asOf), '게시 기준 시각을 확인하지 못했습니다.');
  studioAssert(value.expiresAt === null || timestamp(value.expiresAt), '게시 만료 시각을 확인하지 못했습니다.');
  studioAssert(
    value.revokedAt === undefined || value.revokedAt === null || timestamp(value.revokedAt),
    '게시 중지 시각을 확인하지 못했습니다.',
  );
  if (value.dataVersion !== undefined)
    studioAssert(
      typeof value.dataVersion === 'string' && /^[a-f0-9]{64}$/.test(value.dataVersion),
      '게시 데이터 버전을 확인하지 못했습니다.',
    );
  // Owner-only metadata is accepted at the API boundary, but the activity keeps only
  // the explicit receipt fields. No server-provided URL/HTML is rendered.
  return {
    token: value.token,
    version: value.version,
    visibility: value.visibility,
    allowRemix: value.allowRemix,
    expiresAt: value.expiresAt,
    asOf: value.asOf,
    ...(value.dataVersion !== undefined ? { dataVersion: value.dataVersion } : {}),
    ...(value.revokedAt !== undefined ? { revokedAt: value.revokedAt } : {}),
  };
}
export const publishedDashboardPath = (publication: StudioPublicationResult) =>
  '/published/' + encodeURIComponent(publication.token);
/** Read-only remix handoff. Access, remix consent and expiry are rechecked by the remix route itself. */
export type StudioRemixResult = { token: string; version: number };
export function validateRemixResult(input: unknown): StudioRemixResult {
  studioKeys(input, ['token', 'version']);
  const value = input as StudioRemixResult;
  studioAssert(typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token), '복제 링크를 확인하지 못했습니다.');
  studioAssert(Number.isSafeInteger(value.version) && value.version > 0, '복제 버전을 확인하지 못했습니다.');
  // Only the explicit receipt fields are kept. No server-provided URL or HTML is rendered.
  return { token: value.token, version: value.version };
}
export const publishedRemixPath = (remix: StudioRemixResult) => '/published/' + encodeURIComponent(remix.token) + '/remix';
export type StudioRemixSaveResult = { dashboardId: number; sourceId: number; revision: string; version: number };
export function validateRemixSaveResult(value: any): StudioRemixSaveResult {
  studioAssert(
    !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).every(key => ['dashboardId', 'sourceId', 'revision', 'version'].includes(key)) &&
      Number.isSafeInteger(value.dashboardId) &&
      value.dashboardId > 0 &&
      Number.isSafeInteger(value.sourceId) &&
      value.sourceId > 0 &&
      Number.isSafeInteger(value.version) &&
      value.version > 0 &&
      typeof value.revision === 'string' &&
      /^[a-f0-9]{64}$/.test(value.revision),
    '비공개 복제 완료 기록을 확인하지 못했습니다.',
  );
  return value;
}
export type StudioExecution = {
  runId: string;
  requestId: string;
  dashboardId: number;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  requiresRequest?: boolean;
  result?: StudioRunResult;
  saveResult?: StudioSaveResult;
  publicationResult?: StudioPublicationResult;
  remixResult?: StudioRemixResult;
  remixSaveResult?: StudioRemixSaveResult;
  creationResult?: { proposalId: string; sourceId: number; sourceRevision: string };
  creationSaveResult?: { dashboardId: number; sourceId: number; revision: string };
  baseDocumentHash?: string;
  baseRevision?: string;
  sourceRevision?: string;
  clientEditVersion?: number;
  selectedBlockId?: string | null;
};
export function validateExecution(input: unknown, dashboardId: number): StudioExecution {
  const value = input as StudioExecution;
  studioAssert(
    !!value && typeof value === 'object' && value.dashboardId === dashboardId,
    '다른 대시보드의 실행 기록입니다.',
  );
  studioAssert(
    typeof value.runId === 'string' &&
      /^[-a-zA-Z0-9_]{1,128}$/.test(value.runId) &&
      typeof value.requestId === 'string' &&
      value.requestId.length <= 128,
    '실행 ID를 확인하지 못했습니다.',
  );
  studioAssert(Object.prototype.hasOwnProperty.call(STATUS_LABELS, value.status), '실행 상태를 확인하지 못했습니다.');
  studioAssert(
    Array.isArray(value.steps) &&
      value.steps.length > 0 &&
      value.steps.length <= 7 &&
      new Set(value.steps.map(s => s.stepId)).size === value.steps.length,
    '실행 단계를 확인하지 못했습니다.',
  );
  for (const step of value.steps)
    studioAssert(
      !!step &&
        Object.prototype.hasOwnProperty.call(STEP_LABELS, step.stepId) &&
        Object.prototype.hasOwnProperty.call(STATUS_LABELS, step.status) &&
        typeof step.retryable === 'boolean',
      '실행 단계 형식이 올바르지 않습니다.',
    );
  if (value.saveResult) {
    const document = validateStudioDocument(value.saveResult.document);
    studioAssert(
      document.dashboardId === dashboardId && /^[a-f0-9]{64}$/.test(document.revision ?? ''),
      '저장된 실행 결과의 문서 버전을 확인해 주세요.',
    );
    studioAssert(
      !!value.saveResult.idMap && typeof value.saveResult.idMap === 'object' && !Array.isArray(value.saveResult.idMap),
      '저장 ID 변환을 확인해 주세요.',
    );
    for (const [from, to] of Object.entries(value.saveResult.idMap))
      studioAssert(
        typeof from === 'string' && typeof to === 'string' && !!to && !to.startsWith('new:'),
        '저장 ID 변환을 확인해 주세요.',
      );
  }
  if (value.publicationResult !== undefined) {
    value.publicationResult = validatePublicationResult(value.publicationResult);
    studioAssert(
      value.steps.some(step => step.stepId === 'publish' && step.status === 'succeeded'),
      '게시 완료 단계와 결과가 일치하지 않습니다.',
    );
  }
  if (value.remixResult !== undefined) {
    value.remixResult = validateRemixResult(value.remixResult);
    studioAssert(
      value.steps.some(step => step.stepId === 'remix' && step.status === 'succeeded'),
      '복제 준비 완료 단계와 결과가 일치하지 않습니다.',
    );
    studioAssert(['succeeded', 'completed'].includes(value.status), '복제 준비가 끝난 실행에만 연결할 수 있습니다.');
  }
  if (value.remixSaveResult !== undefined) {
    value.remixSaveResult = validateRemixSaveResult(value.remixSaveResult);
    studioAssert(
      !!remixHandoff(value) &&
        value.remixResult.version === value.remixSaveResult.version &&
        value.remixSaveResult.dashboardId !== dashboardId,
      '비공개 복제 완료 기록의 요청을 확인해 주세요.',
    );
  }
  if (value.creationResult !== undefined) {
    const p = value.creationResult;
    studioKeys(p, ['proposalId', 'sourceId', 'sourceRevision']);
    studioAssert(
      typeof p.proposalId === 'string' &&
        /^[-a-zA-Z0-9_]{1,128}$/.test(p.proposalId) &&
        Number.isSafeInteger(p.sourceId) &&
        p.sourceId > 0 &&
        /^[a-f0-9]{64}$/.test(p.sourceRevision) &&
        value.status === 'succeeded' &&
        value.steps.some(s => s.stepId === 'createProposal' && s.status === 'succeeded'),
      '신규 생성 제안의 실행 기준을 확인해 주세요.',
    );
    studioAssert(
      !value.result && !value.saveResult && !value.publicationResult && !value.remixResult,
      '신규 생성에 기존 대시보드 변경을 섞을 수 없습니다.',
    );
  }
  if (value.creationSaveResult !== undefined) {
    const r = value.creationSaveResult;
    studioKeys(r, ['dashboardId', 'sourceId', 'revision']);
    studioAssert(
      !!value.creationResult &&
        Number.isSafeInteger(r.dashboardId) &&
        r.dashboardId > 0 &&
        r.dashboardId !== dashboardId &&
        r.sourceId === value.creationResult.sourceId &&
        /^[a-f0-9]{64}$/.test(r.revision),
      '신규 비공개 저장 기록을 확인해 주세요.',
    );
  }
  return value;
}
/** A handoff link is offered only for a finished remix step inside an overall succeeded run. */
export const remixHandoff = (run: StudioExecution) =>
  run.remixResult &&
  ['succeeded', 'completed'].includes(run.status) &&
  run.steps.some(step => step.stepId === 'remix' && step.status === 'succeeded')
    ? run.remixResult
    : undefined;
export const retryStep = (run: StudioExecution) =>
  run.steps.find(s => s.retryable && ['failed', 'interrupted', 'cancelled'].includes(s.status));
export const executionSummary = (run: StudioExecution) => {
  if (run.creationSaveResult) return '비공개 생성 완료 · 별도 대시보드로 저장했습니다. 현재 편집은 유지했습니다.';
  if (run.creationResult) return '새 대시보드 제안 완료 · 지표·차원과 미리보기를 확인한 뒤 비공개로 저장하세요.';
  if (run.remixSaveResult) return '비공개 복제 완료 · 새 대시보드로 저장했습니다. 현재 편집은 유지했습니다.';
  const saved = run.steps.some(s => s.stepId === 'saveDraft' && s.status === 'succeeded');
  const publish = run.steps.find(s => s.stepId === 'publish');
  if (run.publicationResult?.revokedAt)
    return `${saved ? '저장 완료 · ' : ''}게시 중지됨 · v${run.publicationResult.version}. 중지된 링크는 열 수 없습니다.`;
  if (run.publicationResult) {
    const scope = run.publicationResult.visibility === 'link' ? '링크 공유' : '비공개';
    return `${saved ? '저장 완료 · ' : ''}게시 완료 · v${
      run.publicationResult.version
    } · ${scope}. 게시 기록의 링크에서 접근 상태를 확인하세요.`;
  }
  const remix = run.steps.find(step => step.stepId === 'remix');
  if (remix?.status === 'failed' && remix.errorCode === 'REMIX_UNAVAILABLE')
    return '복제할 게시본이 없거나 접근·복제 허용·만료 상태를 확인하지 못했습니다. 게시 설정이나 링크를 확인해 주세요. 기존 초안은 유지했습니다.';
  if (run.remixResult)
    return `복제 준비 완료 · v${run.remixResult.version}. 내 데이터와 열 매핑을 확인하고 아래 연결 카드에서 저장 상태를 확인해 주세요.`;
  if (saved && publish?.status === 'failed')
    return '저장 완료 · 게시 실패. 저장 결과는 유지되며 게시 링크는 갱신되지 않았습니다. 게시 단계만 다시 시도할 수 있습니다.';
  if (saved)
    return ['succeeded', 'completed'].includes(run.status)
      ? '저장 완료 · 서버에 반영됐습니다.'
      : '저장 완료 · 이후 단계는 끝나지 않았습니다. 저장 결과는 유지됩니다.';
  if (run.status === 'unsupported') return '지원 예정 기능입니다. 저장하거나 공유하지 않았습니다.';
  if (run.status === 'interrupted') return '서버 실행이 중단됐습니다. 완료 단계는 유지되며 자동 재실행하지 않습니다.';
  if (run.status === 'cancelled') return '실행을 중지했습니다. 단계별 저장 여부를 확인하세요.';
  if (run.status === 'failed' || run.status === 'partial')
    return '일부 단계가 끝나지 않았습니다. 완료 단계는 반복하지 않고 실패 단계부터 다시 시도할 수 있습니다.';
  if (run.status === 'running' || run.status === 'pending') return '요청을 처리하고 있습니다. 단계별 상태를 확인하세요.';
  return '요청 처리가 끝났습니다. 초안 변경과 서버 저장은 단계별로 구분됩니다.';
};
export async function listExecutions(dashboardId: number): Promise<StudioExecution[]> {
  try {
    const { data } = await get('/studio/runs', { dashboardId });
    studioAssert(Array.isArray(data) && data.length <= 50, '실행 목록을 확인하지 못했습니다.');
    return data.map(row => validateExecution(row, dashboardId));
  } catch (error) {
    throw toStudioApiError(error);
  }
}
export async function executionAction(
  run: StudioExecution,
  action: 'retry' | 'cancel' | 'get',
  body?: unknown,
): Promise<StudioExecution> {
  try {
    const url = '/studio/runs/' + encodeURIComponent(run.runId);
    const { data } = action === 'get' ? await get(url) : await post(url + '/' + action, body ?? {}, { timeout: 180000 });
    return validateExecution(data, run.dashboardId);
  } catch (error) {
    throw toStudioApiError(error);
  }
}

/** Same canonical, revision-free SHA-256 as the server. Only document metadata is hashed. */
export async function documentFingerprint(document: StudioRunContext['document']): Promise<string> {
  const copy = { ...document };
  delete copy.revision;
  const canonical = (value: any): any =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, canonical(value[key])]),
        )
      : value;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(copy)));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
export async function canResumeExecution(
  run: StudioExecution,
  context: StudioRunContext,
  recovered: boolean,
): Promise<boolean> {
  if (
    run.dashboardId !== context.dashboardId ||
    run.sourceRevision !== context.expectedSourceRevision ||
    (recovered && context.clientEditVersion !== 0)
  )
    return false;
  // A save can remount the editor before publication fails. Resume only publication from
  // the exact committed document; never re-send the old prompt or repeat the save.
  if (
    retryStep(run)?.stepId === 'publish' &&
    run.steps.some(step => step.stepId === 'saveDraft' && step.status === 'succeeded') &&
    run.saveResult?.document.revision === context.expectedRevision &&
    run.saveResult.document.sourceId === context.document.sourceId
  )
    return (await documentFingerprint(run.saveResult.document)) === (await documentFingerprint(context.document));
  if (
    run.dashboardId !== context.dashboardId ||
    run.baseRevision !== context.expectedRevision ||
    run.sourceRevision !== context.expectedSourceRevision ||
    (run.selectedBlockId ?? null) !== (context.selectedBlockId ?? null) ||
    (recovered && context.clientEditVersion !== 0) ||
    !/^[a-f0-9]{64}$/.test(run.baseDocumentHash ?? '')
  )
    return false;
  return run.baseDocumentHash === (await documentFingerprint(context.document));
}

/** Explicit mapping confirmation; server binds publication, version and single clone to this run. */
export async function saveExecutionRemix(run: StudioExecution, request: RemixSaveInput): Promise<StudioExecution> {
  const { data } = await post('/studio/runs/' + encodeURIComponent(run.runId) + '/remix', request, { timeout: 180000 });
  const result = validateExecution(data, run.dashboardId);
  studioAssert(
    result.runId === run.runId &&
      !!result.remixSaveResult &&
      result.remixSaveResult.sourceId === request.targetSourceId &&
      result.remixSaveResult.version === request.expectedVersion,
    '비공개 복제 저장 결과를 확인하지 못했습니다.',
  );
  return result;
}

/** Read-only cached proposal. No model call on refresh or reopening. */
export async function getExecutionCreation(run: StudioExecution): Promise<CreationProposal> {
  const binding = run.creationResult;
  studioAssert(!!binding, '생성 실행을 확인해 주세요.');
  const { data } = await get('/studio/runs/' + encodeURIComponent(run.runId) + '/creation');
  const proposal = validateCreationProposal(data, binding.sourceId);
  studioAssert(
    proposal.proposalId === binding.proposalId && proposal.sourceRevision === binding.sourceRevision,
    '실행과 생성안의 기준이 다릅니다.',
  );
  return proposal;
}
export async function saveExecutionCreation(run: StudioExecution): Promise<StudioExecution> {
  const p = run.creationResult;
  studioAssert(!!p, '생성 실행을 확인해 주세요.');
  const { data } = await post(
    '/studio/runs/' + encodeURIComponent(run.runId) + '/creation',
    {
      proposalId: p.proposalId,
      expectedSourceRevision: p.sourceRevision,
    },
    { timeout: 180000 },
  );
  const completed = validateExecution(data, run.dashboardId);
  studioAssert(
    completed.runId === run.runId &&
      !!completed.creationSaveResult &&
      completed.creationResult?.proposalId === p.proposalId &&
      completed.creationSaveResult.sourceId === p.sourceId,
    '신규 비공개 저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.',
  );
  return completed;
}

export type CreationClarificationRequest = {
  requestId: string;
  proposalId: string;
  expectedSourceRevision: string;
  refundDenominator: 'orders' | 'amount';
};
export async function clarifyExecutionCreation(
  run: StudioExecution,
  request: CreationClarificationRequest,
  signal?: AbortSignal,
): Promise<StudioExecution> {
  const { data } = await post('/studio/runs/' + encodeURIComponent(run.runId) + '/creation/clarify', request, {
    timeout: 180000,
    signal,
  });
  const completed = validateExecution(data, run.dashboardId);
  studioAssert(
    completed.runId === run.runId &&
      !!completed.creationResult &&
      !!run.creationResult &&
      completed.creationResult.sourceId === run.creationResult.sourceId &&
      completed.creationResult.sourceRevision === request.expectedSourceRevision &&
      completed.creationResult.proposalId !== request.proposalId,
    '계산 기준 답변의 실행을 확인하지 못했습니다.',
  );
  return completed;
}
