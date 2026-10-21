import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  ExecutionRequest,
  CreationMessageRequest,
  messageExecutionCreation,
  StudioExecution,
  executionAction,
  saveExecutionRemix,
  saveExecutionCreation,
  clarifyExecutionCreation,
  listExecutions,
  retryStep,
  executionSummary,
  canResumeExecution,
} from './studioExecution';
import { studioRequestId, StudioSaveResult } from './studioApi';
import { studioFilterSummary, studioDateRangeSummary } from './studioDocument';
import { StudioFilter, StudioDateRange } from './studioTypes';
import StudioExecutionActivity from './StudioExecutionActivity';
import StudioConditionReview from './StudioConditionReview';
import { AssistantMessage, messageText } from '../assistantTransport';
import {
  canApplyStudioRun,
  StudioRunContext,
  StudioRunResult,
  studioAssistantTransport,
  validateStudioRun,
} from './studioRunTransport';
type Props = {
  draft?: { text: string; onChange: (text: string) => void };
  context: StudioRunContext;
  selectedTitle?: string;
  /** Scope confirmed for the rows on screen. The card never claims a filter that is not displayed yet. */
  filterScope?: { applied: StudioFilter[]; pending: boolean; dateRange?: StudioDateRange; conditionsApplied?: boolean };
  onApply: (result: StudioRunResult) => boolean;
  locked: boolean;
  onPrepareCreationPublication?: (target: NonNullable<StudioExecution['creationSaveResult']>) => void;
  onSaved?: (saved: StudioSaveResult, submitted: StudioRunContext) => Promise<boolean>;
};
export default function StudioConversation({
  draft,
  context,
  selectedTitle,
  filterScope,
  onApply,
  locked,
  onSaved,
  onPrepareCreationPublication,
}: Props) {
  const current = useRef(context);
  current.current = context;
  const apply = useRef(onApply);
  apply.current = onApply;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [localInput, setLocalInput] = useState('');
  const input = draft?.text ?? localInput;
  const inputRef = useRef(input);
  inputRef.current = input;
  const setInput = draft?.onChange ?? setLocalInput;
  const [notice, setNotice] = useState('');
  const [conditionReview, setConditionReview] = useState<{ result: StudioRunResult; before: StudioRunContext } | null>(null);
  useEffect(
    () => setConditionReview(null),
    [context.dashboardId, context.document.sourceId, context.expectedSourceRevision],
  );
  const [runs, setRuns] = useState<StudioExecution[]>([]);
  const [activityError, setActivityError] = useState('');
  const [acting, setActing] = useState(false);
  const [ignoredCreation, setIgnoredCreation] = useState<string | null>(null);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [creationError, setCreationError] = useState('');
  const creationAttempt = useRef<{ run: StudioExecution; request: CreationMessageRequest } | null>(null);
  const creationController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      creationController.current?.abort();
    };
  }, []);
  const requests = useRef(new Map<string, ExecutionRequest>());
  const refreshClock = useRef(0);
  const presentationContexts = useRef(new Map<string, StudioRunContext>());
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const updateRun = useCallback((run: StudioExecution) => {
    refreshClock.current += 1;
    setRuns(rows => [run, ...rows.filter(row => row.runId !== run.runId)].slice(0, 10));
  }, []);
  const refresh = useCallback(async () => {
    const generation = refreshClock.current;
    const dashboardId = current.current.dashboardId;
    try {
      const rows = await listExecutions(dashboardId);
      if (generation !== refreshClock.current || dashboardId !== current.current.dashboardId) return;
      setRuns(rows);
      if (rows[0]?.remixSaveResult || rows[0]?.creationSaveResult) setNotice(executionSummary(rows[0]));
      setActivityError('');
    } catch (cause) {
      if (generation === refreshClock.current)
        setActivityError(cause instanceof Error ? cause.message : '실행 상태를 확인하지 못했습니다.');
    }
  }, [context.dashboardId]);
  const receive = useRef<(run: StudioExecution, result?: StudioRunResult) => void>(() => undefined);
  receive.current = async (run, result) => {
    updateRun(run);
    if (run.saveResult) {
      const submitted = presentationContexts.current.get(run.requestId);
      if (
        !submitted ||
        lockedRef.current ||
        submitted.clientEditVersion !== current.current.clientEditVersion ||
        submitted.expectedRevision !== current.current.expectedRevision ||
        submitted.expectedSourceRevision !== current.current.expectedSourceRevision ||
        submitted.selectedBlockId !== current.current.selectedBlockId
      ) {
        setNotice(executionSummary(run) + ' 요청 이후의 편집은 유지했습니다. 최신 저장 내용과 비교한 뒤 이어서 편집하세요.');
        return;
      }
      // Set the complete outcome before onSaved can replace this workspace. The durable
      // activity receipt is also restored by listExecutions after that remount.
      setNotice(executionSummary(run));
      const applied = await saved.current?.(run.saveResult, submitted);
      if (!applied) setNotice(executionSummary(run) + ' 현재 편집은 유지했습니다.');
      return;
    }
    // A common-scope proposal never inherits model consent from a combined save request.
    if (result?.intent === 'edit' && result.proposedOperations.some(operation => operation.type === 'setConditions')) {
      const before = presentationContexts.current.get(run.requestId);
      if (
        !before ||
        before.dashboardId !== current.current.dashboardId ||
        lockedRef.current ||
        !canApplyStudioRun(result, current.current)
      ) {
        setNotice('조건 변경안을 기다리는 동안 편집 기준이 바뀌었습니다. 초안을 유지했습니다. 현재 상태로 다시 질문하세요.');
        return;
      }
      setConditionReview({ result, before });
      setNotice('조건 변경안과 전체 미리보기를 확인하세요. 적용하거나 저장하지 않았습니다.');
      return;
    }
    if (run.steps.some(step => step.stepId === 'saveDraft' && step.status !== 'succeeded')) {
      setNotice(
        'AI 제안은 준비됐지만 저장은 완료되지 않았습니다. 초안에 자동 적용하지 않았습니다. 실패한 저장 단계부터 다시 시도하세요.',
      );
      return;
    }
    const presentation = presentationContexts.current.get(run.requestId);
    const applicable = result && presentation ? { ...result, clientEditVersion: presentation.clientEditVersion } : result;
    if (!applicable) {
      setNotice(executionSummary(run));
      return;
    }
    if (applicable.intent !== 'edit') {
      setNotice('답변만 표시했습니다. 블록은 변경하지 않았습니다.');
      return;
    }
    if (lockedRef.current || !canApplyStudioRun(applicable, current.current)) {
      setNotice(
        '응답을 기다리는 동안 편집·선택·저장 기준이 바뀌었습니다. 변경을 적용하지 않았습니다. 현재 상태로 다시 요청해 주세요.',
      );
      return;
    }
    setNotice(
      apply.current(applicable)
        ? '선택 블록에 적용했습니다. 저장 전 초안이며 되돌리기로 취소할 수 있습니다.'
        : '변경을 적용하지 못했습니다. 기존 내용을 유지했습니다.',
    );
  };
  const transport = useMemo(
    () =>
      studioAssistantTransport(() => current.current, {
        onRequest: request => {
          setConditionReview(null);
          requests.current.set(request.requestId, request);
          presentationContexts.current.set(request.requestId, request);
          if (requests.current.size > 10) requests.current.delete(requests.current.keys().next().value);
          setActivityError('');
        },
        onExecution: updateRun,
      }),
    [updateRun],
  );
  const { messages, setMessages, sendMessage, status, error, clearError, stop } = useChat<AssistantMessage>({
    id: 'studio-' + context.dashboardId,
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      const payload = message.metadata?.result;
      if (!isAbort && !isError && payload?.execution) {
        receive.current(payload.execution, payload.result);
        const request = requests.current.get(payload.execution.requestId);
        const conditionProposal = payload.result?.proposedOperations.some(operation => operation.type === 'setConditions');
        const needsFollowUp = payload.result?.intent === 'clarify' || payload.result?.intent === 'unsupported';
        // Keep questions that still need clarification or explicit condition review.
        // A late successful response must not clear a newer question.
        if (
          payload.execution.status === 'succeeded' &&
          !conditionProposal &&
          !needsFollowUp &&
          request?.prompt === inputRef.current.trim()
        )
          setInput('');
      }
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    refresh();
  }, [refresh]);
  const unfinished = runs.some(run => ['running', 'pending'].includes(run.status));
  useEffect(() => {
    if (!busy && !unfinished) return undefined;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [busy, unfinished, refresh]);
  const retry = async (run: StudioExecution) => {
    const step = retryStep(run);
    if (!step || acting || busy || lockedRef.current) return;
    let original = requests.current.get(run.requestId);
    const previousPresentation = presentationContexts.current.get(run.requestId);
    const retryContext = current.current;
    const publishOnly =
      step.stepId === 'publish' && run.steps.some(s => s.stepId === 'saveDraft' && s.status === 'succeeded');
    if (
      !publishOnly &&
      previousPresentation &&
      (previousPresentation.clientEditVersion !== retryContext.clientEditVersion ||
        previousPresentation.expectedRevision !== retryContext.expectedRevision ||
        previousPresentation.expectedSourceRevision !== retryContext.expectedSourceRevision ||
        previousPresentation.selectedBlockId !== retryContext.selectedBlockId)
    ) {
      setActivityError('편집 기준이 바뀌었습니다. 현재 내용을 유지하고 새 요청으로 시작해 주세요.');
      return;
    }
    try {
      // Recent history deliberately omits the saved document. Read the owner-scoped
      // durable result before comparing a committed revision after an editor remount.
      const resumable = publishOnly && !run.saveResult ? await executionAction(run, 'get') : run;
      if (!(await canResumeExecution(resumable, retryContext, !original))) {
        setActivityError(
          '편집 기준이 바뀌었습니다. 같은 블록과 원래 초안에서 재시도하거나 현재 내용으로 새 요청을 보내 주세요.',
        );
        return;
      }
    } catch {
      setActivityError(
        '원래 초안과 현재 내용이 같은지 확인하지 못했습니다. 현재 내용을 유지하고 새 요청으로 시작해 주세요.',
      );
      return;
    }
    if (
      retryContext.clientEditVersion !== current.current.clientEditVersion ||
      retryContext.expectedRevision !== current.current.expectedRevision ||
      retryContext.expectedSourceRevision !== current.current.expectedSourceRevision ||
      retryContext.selectedBlockId !== current.current.selectedBlockId
    ) {
      setActivityError('확인 중 편집 기준이 바뀌었습니다. 현재 내용으로 새 요청을 보내 주세요.');
      return;
    }
    presentationContexts.current.set(run.requestId, retryContext);
    if (!publishOnly && run.requiresRequest && !original) {
      if (!input.trim()) {
        setActivityError('아래 입력란에 원래 요청을 다시 적어 주세요.');
        return;
      }
      original = {
        ...current.current,
        requestId: run.requestId,
        prompt: input.trim(),
        ...(run.clientEditVersion !== undefined ? { clientEditVersion: run.clientEditVersion } : {}),
      };
      requests.current.set(run.requestId, original);
    }
    setActing(true);
    setActivityError('');
    try {
      const next = await executionAction(run, 'retry', {
        stepId: step.stepId,
        ...(!publishOnly && original ? { request: original } : {}),
      });
      const base = original ?? {
        ...retryContext,
        clientEditVersion: run.clientEditVersion ?? retryContext.clientEditVersion,
      };
      const result =
        next.result && !next.saveResult && !next.publicationResult ? validateStudioRun(next.result, base) : undefined;
      receive.current(next, result);
    } catch (cause) {
      setActivityError(cause instanceof Error ? cause.message : '실패 단계 재시도 결과를 확인하지 못했습니다.');
    } finally {
      setActing(false);
    }
  };
  const cancel = async (run: StudioExecution) => {
    setActing(true);
    setActivityError('');
    try {
      updateRun(await executionAction(run, 'cancel'));
      await refresh();
    } catch (cause) {
      setActivityError(cause instanceof Error ? cause.message : '중지 상태를 확인하지 못했습니다.');
    } finally {
      setActing(false);
    }
  };
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  const latest = runs[0];
  // UC037: a saved creation remains the conversation target until explicit return.
  const creationContext =
    latest?.status === 'succeeded' && latest.creationResult && latest.runId !== ignoredCreation ? latest : null;
  const creationTarget = creationContext && !creationContext.creationSaveResult ? creationContext : null;
  const savedCreation = creationContext?.creationSaveResult;
  const prepareCreationPublication = () => {
    if (!savedCreation || busy || acting || lockedRef.current) return;
    // Preparation is deliberately bounded; no model or original-editor fallback can publish.
    if (
      !/^(?:(?:저장한\s*대시보드\s*)?게시\s*준비\s*(?:해\s*줘|해\s*주세요|해주세요)|공유\s*설정\s*열어\s*(?:줘|주세요)|prepare publication)[.!。]?$/i.test(
        input.trim(),
      )
    ) {
      setCreationError(
        '저장한 새 대시보드가 대상입니다. “게시 준비해 줘”로 공개 범위를 확인하세요. 내용 수정은 새 대시보드 열기에서 이어가세요. 질문은 유지됩니다.',
      );
      return;
    }
    setInput('');
    setCreationError('');
    onPrepareCreationPublication?.(savedCreation);
  };
  const submitCreation = async () => {
    if (acting || busy || lockedRef.current || creationController.current || !input.trim()) return;
    const target = creationAttempt.current?.run ?? creationTarget;
    if (!target?.creationResult) return;
    creationAttempt.current ??= {
      run: target,
      request: {
        requestId: studioRequestId(),
        proposalId: target.creationResult.proposalId,
        expectedSourceRevision: target.creationResult.sourceRevision,
        prompt: input.trim(),
      },
    };
    const attempt = creationAttempt.current,
      active = new AbortController(),
      dashboardId = current.current.dashboardId;
    creationController.current = active;
    setActing(true);
    setCreationError('');
    clearError();
    setNotice('');
    setMessages(rows =>
      rows.some(message => message.id === attempt.request.requestId + '-user')
        ? rows
        : [
            ...rows,
            {
              id: attempt.request.requestId + '-user',
              role: 'user',
              parts: [{ type: 'text', text: attempt.request.prompt }],
            },
          ],
    );
    try {
      const completed = await messageExecutionCreation(attempt.run, attempt.request, active.signal);
      if (!mounted.current || dashboardId !== current.current.dashboardId) return;
      updateRun(completed);
      setInput('');
      setCreationUncertain(false);
      creationAttempt.current = null;
      const answer = completed.creationSaveResult
        ? executionSummary(completed)
        : '저장 전 생성안을 수정했습니다. 같은 카드의 전체 미리보기를 확인해 주세요.';
      setMessages(rows => [
        ...rows,
        { id: attempt.request.requestId + '-assistant', role: 'assistant', parts: [{ type: 'text', text: answer }] },
      ]);
      setNotice(answer);
    } catch (cause) {
      if (!mounted.current || dashboardId !== current.current.dashboardId) return;
      const status = Number((cause as any)?.response?.status),
        unknown = !status || status >= 500;
      setCreationUncertain(unknown);
      if (!unknown) creationAttempt.current = null;
      setCreationError(
        unknown
          ? '생성안 요청 결과를 확인하지 못했습니다. 질문을 유지했습니다. 같은 요청으로 다시 확인해 주세요.'
          : status === 403
          ? '이 실행 또는 데이터에 접근할 수 없습니다. 원본과 질문은 유지됩니다.'
          : '생성안의 블록 번호·제목과 계산 기준을 확인해 주세요. 저장은 “이 생성안을 저장해 줘”처럼 따로 요청하세요. 이전 결과와 질문은 유지됩니다.',
      );
    } finally {
      creationController.current = null;
      if (mounted.current && dashboardId === current.current.dashboardId) setActing(false);
    }
  };
  const selected = context.document.blocks.find(block => block.id === context.selectedBlockId);
  const grain = selected?.display.timeGrain;
  return (
    <div className="studio-ai studio-live-ai">
      <div className="studio-ai-content">
        <h2>대시보드를 함께 완성하기</h2>
        <p>
          “새 대시보드를 만들어 줘”로 지표·차원을 제안받고, 계산 미리보기 후 비공개로 저장하세요. 선택 블록 수정·저장·내
          데이터 복제도 이 대화에서 이어갑니다.
        </p>
        <details className="studio-execution-hint">
          <summary>저장·공유 요청 안내</summary>
          <p>
            {savedCreation
              ? '“게시 준비해 줘”로 저장한 새 대시보드의 공개 범위를 확인하세요. 게시하기를 눌렀을 때 링크가 만들어집니다.'
              : '“저장하고 링크로 공유해줘”라고 명시하면 저장 후 링크를 만듭니다. “내 데이터로 복제해줘”는 게시본과 열 매핑을 확인합니다. 공유 범위가 불분명하면 공개하지 않습니다.'}
          </p>
        </details>
        <div className="studio-context-card">
          <span className="studio-eyebrow">현재 문맥</span>
          <strong>
            {savedCreation
              ? '새 대시보드 #' + savedCreation.dashboardId + ' · 저장 완료'
              : creationTarget
              ? '새 대시보드 · 저장 전 생성안'
              : selectedTitle || '선택한 블록 없음'}
          </strong>
          <span>
            {creationContext
              ? '소스 #' + creationContext.creationResult.sourceId + ' · 전체 기간 · 필터 없음'
              : studioDateRangeSummary(filterScope?.dateRange) +
                ' · ' +
                (filterScope?.applied.length ? '공통 필터 ' + studioFilterSummary(filterScope.applied) : '필터 없음') +
                (filterScope?.conditionsApplied ? ' · 포함·제외 조건 적용됨' : '')}
          </span>
          {!creationContext && filterScope?.pending && (
            <span>
              문서의 날짜 범위·공통 필터는 아직 조회 결과에 반영되지 않았습니다. AI 요청은 저장된 문서 조건으로 처리됩니다.
            </span>
          )}
          {!creationContext && grain && grain !== 'auto' && (
            <span>{({ day: '일간', week: '주간', month: '월간' } as const)[grain]} 집계 · UTC</span>
          )}
          <span>Codex · gpt-6-luna 요청</span>
        </div>
        {conditionReview && (
          <StudioConditionReview
            before={conditionReview.before.document}
            result={conditionReview.result}
            disabled={
              locked ||
              busy ||
              acting ||
              !canApplyStudioRun(conditionReview.result, context) ||
              JSON.stringify(conditionReview.before.document) !== JSON.stringify(context.document)
            }
            onDismiss={() => {
              setConditionReview(null);
              setNotice('조건 변경안을 닫았습니다. 현재 초안을 유지했습니다.');
            }}
            onApply={() => {
              const pending = conditionReview;
              if (
                lockedRef.current ||
                busy ||
                acting ||
                !canApplyStudioRun(pending.result, current.current) ||
                JSON.stringify(pending.before.document) !== JSON.stringify(current.current.document)
              ) {
                setNotice('조건 변경안의 기준이 달라졌습니다. 현재 초안을 유지했습니다. 다시 질문하세요.');
                return;
              }
              if (apply.current(pending.result)) {
                setConditionReview(null);
                setNotice('조건 변경안을 초안에 적용했습니다. 아직 저장하지 않았습니다. 되돌리기로 취소할 수 있습니다.');
              } else setNotice('조건 변경안을 적용하지 못했습니다. 초안과 질문을 유지했습니다.');
            }}
          />
        )}
        <StudioExecutionActivity
          runs={runs}
          busy={acting || creationUncertain}
          error={activityError}
          onRefresh={refresh}
          onRetry={retry}
          onCancel={cancel}
          onClarification={async (run, request, signal) => {
            const dashboardId = current.current.dashboardId;
            setActing(true);
            try {
              const completed = await clarifyExecutionCreation(run, request, signal);
              if (dashboardId !== current.current.dashboardId) return;
              updateRun(completed);
              setNotice('요청한 생성안을 반영했습니다. 아래 전체 미리보기를 확인해 주세요.');
            } finally {
              if (dashboardId === current.current.dashboardId) setActing(false);
            }
          }}
          onCreation={async run => {
            const dashboardId = current.current.dashboardId;
            setActing(true);
            try {
              const completed = await saveExecutionCreation(run);
              if (dashboardId !== current.current.dashboardId) return;
              updateRun(completed);
              setNotice(executionSummary(completed));
            } finally {
              if (dashboardId === current.current.dashboardId) setActing(false);
            }
          }}
          onRemix={async (run, request, isCurrent) => {
            const dashboardId = current.current.dashboardId;
            setActing(true);
            setNotice('비공개 복제 저장의 완료 여부를 확인하고 있습니다.');
            try {
              const completed = await saveExecutionRemix(run, request);
              if (dashboardId !== current.current.dashboardId || !isCurrent()) return;
              updateRun(completed);
              setNotice(executionSummary(completed));
            } catch (cause) {
              if (dashboardId === current.current.dashboardId && isCurrent())
                setNotice('비공개 복제의 완료 여부를 확인하지 못했습니다. 아래 오류와 같은 요청 재시도로 확인해 주세요.');
              throw cause;
            } finally {
              if (dashboardId === current.current.dashboardId) setActing(false);
            }
          }}
          canRetry={run =>
            !busy &&
            !locked &&
            ((retryStep(run)?.stepId === 'publish' &&
              run.steps.some(s => s.stepId === 'saveDraft' && s.status === 'succeeded')) ||
              !run.requiresRequest ||
              requests.current.has(run.requestId) ||
              !!input.trim())
          }
        />
        {savedCreation ? (
          <p>저장한 새 대시보드의 게시를 준비할 수 있습니다. 내용 수정은 새 대시보드 열기에서 이어가세요.</p>
        ) : creationTarget ? (
          <p>생성안은 블록 번호나 제목으로 수정하고, 확인 후 저장을 요청하세요. 원본 편집기는 유지됩니다.</p>
        ) : (
          !selectedTitle && <p>캔버스에서 블록을 먼저 선택하면 해당 블록만 수정할 수 있습니다.</p>
        )}
        <div className="studio-ai-messages" aria-label="AI 대화" aria-live="polite">
          {messages.map(message => (
            <div className={'studio-ai-message studio-ai-' + message.role} key={message.id}>
              <span>{message.role === 'user' ? '나' : 'AI'}</span>
              <p>{messageText(message)}</p>
            </div>
          ))}
        </div>
        {busy && <p role="status">AI 응답과 변경 검증을 기다리는 중입니다…</p>}
        {notice && <Alert severity="info">{notice}</Alert>}
        {error && <Alert severity="error">{error.message}</Alert>}
      </div>
      <form
        className="studio-ai-composer"
        onSubmit={event => {
          event.preventDefault();
          if (!input.trim() || busy || acting || locked) return;
          clearError();
          setNotice('');
          if (savedCreation) {
            prepareCreationPublication();
            return;
          }
          if (creationTarget || creationAttempt.current) {
            void submitCreation();
            return;
          }
          sendMessage({ text: input.trim() });
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="대화 요청 대상">
          <span>
            {savedCreation
              ? '대상: 저장한 새 대시보드 #' + savedCreation.dashboardId
              : creationTarget || creationAttempt.current
              ? '대상: 저장 전 생성안 · 소스 #' +
                (creationAttempt.current?.run.creationResult?.sourceId ?? creationTarget?.creationResult?.sourceId)
              : '대상: 현재 원본 편집'}
          </span>
          {creationContext && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || acting || creationUncertain || locked}
              onClick={() => {
                setIgnoredCreation(creationContext.runId);
                setCreationError('');
                setNotice('현재 원본 편집으로 돌아왔습니다. 질문은 자동 전송하지 않았습니다.');
              }}
            >
              원본 편집으로 돌아가기
            </Button>
          )}
        </div>
        {creationError && <Alert severity="error">{creationError}</Alert>}
        <TextField
          multiline
          minRows={3}
          label="AI에게 요청할 내용"
          placeholder={
            savedCreation
              ? '예: 게시 준비해 줘'
              : creationTarget
              ? '예: 첫 번째 블록의 제목을 바꿔 줘 / 이 생성안을 저장해 줘'
              : '선택 차트를 주간으로 바꿔 줘'
          }
          value={input}
          onChange={event => setInput(event.target.value)}
          inputProps={{ maxLength: 2000 }}
          disabled={busy || acting || locked || creationUncertain}
        />
        <div>
          <span>수정은 초안 · 저장·링크 공유는 명시 요청 시</span>
          {creationController.current ? (
            <Button variant="ghost" onClick={() => creationController.current?.abort()}>
              생성안 요청 중지
            </Button>
          ) : busy ? (
            <Button
              variant="ghost"
              onClick={() => {
                stop();
                setNotice('중지를 요청했습니다. 서버 실행 기록에서 저장 여부를 확인합니다.');
                const running = runs.find(run => ['pending', 'running'].includes(run.status));
                if (running) cancel(running);
                else refresh();
              }}
            >
              중지
            </Button>
          ) : (
            <Button type="submit" variant="default" disabled={!input.trim() || acting || locked}>
              {creationUncertain ? '같은 생성안 요청 다시 확인' : '전송'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
