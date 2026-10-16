import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  ExecutionRequest,
  StudioExecution,
  executionAction,
  saveExecutionRemix,
  saveExecutionCreation,
  listExecutions,
  retryStep,
  executionSummary,
  canResumeExecution,
} from './studioExecution';
import { StudioSaveResult } from './studioApi';
import { studioFilterSummary, studioDateRangeSummary } from './studioDocument';
import { StudioFilter, StudioDateRange } from './studioTypes';
import StudioExecutionActivity from './StudioExecutionActivity';
import { AssistantMessage, messageText } from '../assistantTransport';
import {
  canApplyStudioRun,
  StudioRunContext,
  StudioRunResult,
  studioAssistantTransport,
  validateStudioRun,
} from './studioRunTransport';
type Props = {
  context: StudioRunContext;
  selectedTitle?: string;
  /** Scope confirmed for the rows on screen. The card never claims a filter that is not displayed yet. */
  filterScope?: { applied: StudioFilter[]; pending: boolean; dateRange?: StudioDateRange };
  onApply: (result: StudioRunResult) => boolean;
  locked: boolean;
  onSaved?: (saved: StudioSaveResult, submitted: StudioRunContext) => Promise<boolean>;
};
export default function StudioConversation({ context, selectedTitle, filterScope, onApply, locked, onSaved }: Props) {
  const current = useRef(context);
  current.current = context;
  const apply = useRef(onApply);
  apply.current = onApply;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [runs, setRuns] = useState<StudioExecution[]>([]);
  const [activityError, setActivityError] = useState('');
  const [acting, setActing] = useState(false);
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
          requests.current.set(request.requestId, request);
          presentationContexts.current.set(request.requestId, request);
          if (requests.current.size > 10) requests.current.delete(requests.current.keys().next().value);
          setActivityError('');
        },
        onExecution: updateRun,
      }),
    [updateRun],
  );
  const { messages, sendMessage, status, error, clearError, stop } = useChat<AssistantMessage>({
    id: 'studio-' + context.dashboardId,
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      const payload = message.metadata?.result;
      if (!isAbort && !isError && payload?.execution) receive.current(payload.execution, payload.result);
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
            “저장하고 링크로 공유해줘”라고 명시하면 저장 후 링크를 만듭니다. “내 데이터로 복제해줘”는 게시본과 열 매핑을
            확인합니다. 공유 범위가 불분명하면 공개하지 않습니다.
          </p>
        </details>
        <div className="studio-context-card">
          <span className="studio-eyebrow">현재 문맥</span>
          <strong>{selectedTitle || '선택한 블록 없음'}</strong>
          <span>
            {studioDateRangeSummary(filterScope?.dateRange)} ·{' '}
            {filterScope?.applied.length ? '공통 필터 ' + studioFilterSummary(filterScope.applied) : '필터 없음'}
          </span>
          {filterScope?.pending && (
            <span>
              문서의 날짜 범위·공통 필터는 아직 조회 결과에 반영되지 않았습니다. AI 요청은 저장된 문서 조건으로 처리됩니다.
            </span>
          )}
          {grain && grain !== 'auto' && (
            <span>{({ day: '일간', week: '주간', month: '월간' } as const)[grain]} 집계 · UTC</span>
          )}
          <span>Codex · gpt-6-luna 요청</span>
        </div>
        <StudioExecutionActivity
          runs={runs}
          busy={acting}
          error={activityError}
          onRefresh={refresh}
          onRetry={retry}
          onCancel={cancel}
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
        {!selectedTitle && <p>캔버스에서 블록을 먼저 선택하면 해당 블록만 수정할 수 있습니다.</p>}
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
          sendMessage({ text: input.trim() });
          setInput('');
        }}
      >
        <TextField
          multiline
          minRows={3}
          label="AI에게 요청할 내용"
          placeholder="선택 차트를 주간으로 바꿔 줘"
          value={input}
          onChange={event => setInput(event.target.value)}
          inputProps={{ maxLength: 2000 }}
          disabled={busy || acting || locked}
        />
        <div>
          <span>수정은 초안 · 저장·링크 공유는 명시 요청 시</span>
          {busy ? (
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
              전송
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
