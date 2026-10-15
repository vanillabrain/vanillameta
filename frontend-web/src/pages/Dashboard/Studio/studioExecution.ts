import { get, post } from '@/helpers/apiHelper';
import { studioAssert, validateStudioDocument } from './studioDocument';
import { toStudioApiError, StudioSaveResult } from './studioApi';
import type { StudioRunContext, StudioRunResult } from './studioRunTransport';
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
export type StudioExecution = {
  runId: string;
  requestId: string;
  dashboardId: number;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  requiresRequest?: boolean;
  result?: StudioRunResult;
  saveResult?: StudioSaveResult;
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
  return value;
}
export const retryStep = (run: StudioExecution) =>
  run.steps.find(s => s.retryable && ['failed', 'interrupted', 'cancelled'].includes(s.status));
export const executionSummary = (run: StudioExecution) => {
  const saved = run.steps.some(s => s.stepId === 'saveDraft' && s.status === 'succeeded');
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
    run.baseRevision !== context.expectedRevision ||
    run.sourceRevision !== context.expectedSourceRevision ||
    (run.selectedBlockId ?? null) !== (context.selectedBlockId ?? null) ||
    (recovered && context.clientEditVersion !== 0) ||
    !/^[a-f0-9]{64}$/.test(run.baseDocumentHash ?? '')
  )
    return false;
  return run.baseDocumentHash === (await documentFingerprint(context.document));
}
