import { get, post } from '@/helpers/apiHelper';
import { studioAssert, studioKeys, validateStudioDocument } from './studioDocument';
import { toStudioApiError, StudioSaveResult } from './studioApi';
import type { StudioRunContext, StudioRunResult } from './studioRunTransport';
import { Publication, validatePublication } from './studioPublication';
export const STEP_LABELS = {
  inspectSource: '데이터 확인',
  proposeSemantics: 'AI 제안',
  preview: '계산 검증',
  applyDraft: '초안 준비',
  saveDraft: '대시보드 저장',
  publish: '공유',
  remix: '내 데이터로 복제',
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
  return value;
}
export const retryStep = (run: StudioExecution) =>
  run.steps.find(s => s.retryable && ['failed', 'interrupted', 'cancelled'].includes(s.status));
export const executionSummary = (run: StudioExecution) => {
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
