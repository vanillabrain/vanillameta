import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { get, post } from '@/helpers/apiHelper';
import { assistantTransport, AssistantMessage, messageText } from '../assistantTransport';
import { errorMessage, responseData } from '../dashboardPreview';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import { timeRangeLabel } from './timeSelection';
import MetricTrend from './MetricTrend';
import MetricCalculationEditor from './MetricCalculationEditor';
import { AnalysisUiProvider, analysisFieldClassName } from '@/components/analysis/AnalysisUi';
import { cn } from '@/lib/utils';

/** Radix select items cannot carry an empty value; the sentinel keeps the "all/auto" choice. */
const ENTIRE_DASHBOARD = '__dashboard__';
const AUTOMATIC_METRIC = '__automatic__';

/**
 * Same width contract as before the migration (MUI down('lg') → 1199.95px):
 * below it the panel is a modal sheet with backdrop, focus trap and Escape close.
 */
const ASSISTANT_MODAL_QUERY = '(max-width: 1199.95px)';

function useAssistantModal() {
  const [modal, setModal] = useState(() => window.matchMedia?.(ASSISTANT_MODAL_QUERY).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(ASSISTANT_MODAL_QUERY);
    if (!list) return;
    const sync = (event: MediaQueryListEvent) => setModal(event.matches);
    list.addEventListener?.('change', sync);
    return () => list.removeEventListener?.('change', sync);
  }, []);
  return modal;
}

function AssistantSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  emptyValue,
  emptyLabel,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyValue: string;
  emptyLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', analysisFieldClassName, className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{emptyLabel}</SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DashboardAssistantContent({
  open,
  onClose,
  dashboardId,
  draft,
  filters,
  dateRange,
  trendGrain = 'auto',
  comparePrevious = false,
  disabled,
  onApplied,
}: any) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ask');
  const [selectedWidget, setSelectedWidget] = useState<number | ''>('');
  const [selectedMetricId, setSelectedMetricId] = useState<number | ''>('');
  const [metrics, setMetrics] = useState<Array<{ id: number; label: string; definitionVersion?: number; definition?: any }>>(
    [],
  );
  const [metricError, setMetricError] = useState('');
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricEditor, setMetricEditor] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [undo, setUndo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveConflict, setSaveConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const current = {
    dashboardId,
    databaseId: draft.databaseId,
    currentDraft: draft,
    filters,
    trendGrain,
    comparePrevious,
    ...(dateRange ? { dateRange } : {}),
    ...(mode === 'edit' && selectedWidget !== '' && selectedMetricId !== '' ? { selectedMetricId } : {}),
    ...(selectedWidget !== '' ? { selectedWidget } : {}),
  };
  const context = useRef(current);
  context.current = current;
  const transport = useMemo(() => assistantTransport(() => context.current), []);
  const { messages, sendMessage, status, error, clearError, stop } = useChat<AssistantMessage>({
    id: `dashboard-assistant-${dashboardId}`,
    transport,
    onFinish: ({ message }) => {
      const result = message.metadata?.result;
      if (result?.mode === 'edit') setProposal(result);
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  const stale = proposal && proposal.base !== JSON.stringify(current);
  const undoStale = undo && undo.after !== JSON.stringify(draft);
  const inputRef = useRef<HTMLInputElement>();
  const scroll = useRef<HTMLDivElement>();
  const savingRef = useRef(false);
  useEffect(() => {
    if (selectedWidget !== '' && selectedWidget >= draft.widgets.length) setSelectedWidget('');
  }, [selectedWidget, draft.widgets.length]);
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, proposal, open]);

  useEffect(() => {
    if (!open || mode !== 'edit' || selectedWidget === '') return;
    let active = true;
    setMetricsLoading(true);
    setMetrics([]);
    setMetricError('');
    setSelectedMetricId('');
    get(`/ai/dashboard-metrics/${draft.databaseId}`)
      .then(response => {
        const choices = responseData(response);
        if (!Array.isArray(choices) || choices.some(m => !Number.isSafeInteger(m.id) || typeof m.label !== 'string'))
          throw new Error('저장 지표 목록을 확인하지 못했습니다.');
        if (active) setMetrics(choices);
      })
      .catch(() => {
        if (active) setMetricError('저장 지표를 불러오지 못했습니다. 자연어 수정은 사용할 수 있습니다.');
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, mode, selectedWidget, draft.databaseId]);

  const send = async () => {
    if (busy || saving || disabled || saveConflict || !input.trim() || input.length > 2000) return;
    const text = input.trim();
    setProposal(null);
    setSaveError('');
    setNotice('');
    clearError();
    setInput('');
    await sendMessage({ text }, { body: { mode } });
  };
  const apply = async (revert = false) => {
    if (
      savingRef.current ||
      busy ||
      disabled ||
      saveConflict ||
      (!revert && (!proposal || stale)) ||
      (revert && (!undo || undoStale))
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const before = draft;
    const next = revert ? undo.before : proposal.preview.draft;
    try {
      const result = responseData(
        await post(
          '/ai/dashboard-save',
          { dashboardId, draft: next, expectedRevision: draft.revision },
          { timeout: 180000 },
        ),
      );
      if (result?.id !== dashboardId) throw new Error('변경을 저장하지 못했습니다.');
      const persisted = { ...(result.draft || next), ...(result.revision ? { revision: result.revision } : {}) };
      setUndo(revert ? null : { before, after: JSON.stringify(persisted) });
      setProposal(null);
      setSelectedWidget('');
      setSelectedMetricId('');
      onApplied(persisted);
      setNotice(revert ? '이전 대시보드로 되돌렸습니다.' : '변경을 적용했습니다.');
    } catch (e) {
      if (e?.response?.status === 409) setSaveConflict(true);
      setSaveError(errorMessage(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const close = () => {
    if (!saving) {
      stop();
      onClose();
    }
  };
  const panel = (Title: React.ElementType, Description: React.ElementType) => (
    <>
      <div className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <Title className="font-bold">Assistant</Title>
          <Description className="text-xs text-muted-foreground">현재 대시보드와 함께 분석하기</Description>
        </div>
        <Button variant="ghost" onClick={close} disabled={saving} aria-label="Assistant 닫기">
          닫기
        </Button>
      </div>
      <div className="border-b border-border p-5">
        <p className="text-sm [overflow-wrap:anywhere]">{draft.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {dateRange
            ? dateRange.precision === 'timestamp'
              ? timeRangeLabel(dateRange)
              : `${dateRange.start} ~ ${dateRange.end} (${dateRange.timeZone ?? 'UTC'})`
            : '전체 기간'}{' '}
          · {filters.length ? filters.map(f => `${f.column}: ${f.values.map(String).join(', ')}`).join(' · ') : '필터 없음'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          집계 단위: {({ auto: '자동', day: '일별', week: '주별', month: '월별' } as Record<string, string>)[trendGrain]} ·{' '}
          이전 기간 비교: {comparePrevious ? '사용 (적용 기간과 같은 길이)' : '사용 안 함'}
        </p>
        <AssistantSelect
          id="assistant-widget"
          label="분석할 차트"
          className="mt-3"
          value={selectedWidget === '' ? ENTIRE_DASHBOARD : String(selectedWidget)}
          emptyValue={ENTIRE_DASHBOARD}
          emptyLabel="대시보드 전체"
          disabled={busy || saving}
          options={draft.widgets.map((w, i) => ({ value: String(i), label: w.title }))}
          onChange={value => {
            setSelectedMetricId('');
            setSelectedWidget(value === ENTIRE_DASHBOARD ? '' : Number(value));
          }}
        />
        {mode === 'edit' && selectedWidget !== '' && (
          <>
            <AssistantSelect
              id="assistant-metric"
              label="재사용할 저장 지표"
              className="mt-3"
              value={selectedMetricId === '' ? AUTOMATIC_METRIC : String(selectedMetricId)}
              emptyValue={AUTOMATIC_METRIC}
              emptyLabel="자동 · 새 계산식 허용"
              disabled={busy || saving || metricsLoading || !metrics.length}
              options={metrics.map(m => ({ value: String(m.id), label: m.label }))}
              onChange={value => setSelectedMetricId(value === AUTOMATIC_METRIC ? '' : Number(value))}
            />
            <p className="mt-0.5 text-xs text-muted-foreground">
              {metricsLoading ? '저장 지표를 확인하고 있습니다…' : '선택하면 이 차트만 같은 계산식으로 수정합니다.'}
            </p>
            {metrics.find(m => m.id === selectedMetricId)?.definition && (
              <Button
                variant="ghost"
                className="mt-1"
                disabled={busy || saving || disabled}
                onClick={() => setMetricEditor(true)}
              >
                계산식 변경
              </Button>
            )}
            {metricError && (
              <Notice severity="warning" className="mt-2">
                {metricError}
              </Notice>
            )}
          </>
        )}
      </div>
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto p-5 [overflow-wrap:anywhere]">
        {!messages.length && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">데이터에 대해 질문하거나 대시보드를 수정해 보세요.</p>
            {[
              `${draft.widgets[0]?.title || '주요 지표'}와 범주별 차이를 설명해 줘`,
              '시계열 추세에서 눈에 띄는 변화가 있나요?',
            ].map(text => (
              <Button
                key={text}
                data-wrap-label
                variant="outline"
                className="h-auto justify-start py-2 text-left whitespace-normal [overflow-wrap:anywhere]"
                onClick={() => {
                  setMode('ask');
                  setInput(text);
                }}
              >
                {text}
              </Button>
            ))}
          </div>
        )}
        <div role="log" aria-label="Assistant 대화" aria-live="polite" aria-relevant="additions text">
          {messages.map(m => (
            <div key={m.id} className={cn('mb-4 rounded-lg p-3', m.role === 'user' ? 'bg-primary/10' : 'bg-muted')}>
              <p className="mb-0.5 text-xs font-bold">{m.role === 'user' ? '나' : 'Assistant'}</p>
              <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{messageText(m)}</p>
              {m.metadata?.result?.context && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">근거 · SQL · 데이터 범위</summary>
                  <pre className="text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {JSON.stringify(m.metadata.result.context, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
        {busy && (
          <div role="status">
            <Skeleton className="h-1 w-full" />
            <p className="mt-2 text-sm">현재 데이터로 답변을 준비하고 있습니다…</p>
          </div>
        )}
        {notice && (
          <Notice severity="success" className="mb-2">
            {notice}
          </Notice>
        )}
        {proposal && (
          <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <p className="font-bold">변경 미리보기</p>
            <p className="text-xs">
              아직 저장되지 않았습니다. 변경 적용을 누르면 현재 대시보드에 저장합니다. 기간·필터는 조회에만 적용하며 저장
              SQL에 고정하지 않습니다.
            </p>
            {stale && <Notice severity="warning">화면 조건이 바뀌었습니다. 새 미리보기를 요청해 주세요.</Notice>}
            <p>{proposal.preview.draft.title}</p>
            {proposal.preview.widgets.map((w, i) => (
              <div key={i} className="min-w-0 rounded border border-border">
                {proposal.metricReferences
                  ?.filter(r => r.widgetIndex === i)
                  .map(r => (
                    <p key={r.metricId} className="px-3 pt-2 text-xs text-muted-foreground">
                      저장 지표 재사용: {r.label} · 저장 시 계산식 유지
                    </p>
                  ))}
                <div className={cn('min-w-0', w.type === 'BOARD_NUMERIC' ? 'h-[150px]' : 'h-[280px]')}>
                  <WidgetViewer
                    title={w.title}
                    widgetType={w.type}
                    widgetOption={analysisOptions(w, w.numberNotation || 'compact')}
                    dataSet={w.datas}
                  />
                </div>
                {w.type === 'BOARD_NUMERIC' && (
                  <MetricTrend
                    trend={w.trend}
                    unavailable={w.trendUnavailable}
                    title={w.title}
                    prefix={w.prefix}
                    suffix={w.suffix}
                    decimalPlaces={w.decimalPlaces ?? 0}
                    comparison={w.comparison}
                    previousTrend={w.previousTrend}
                    periods={proposal.preview.comparison}
                  />
                )}
              </div>
            ))}
            <details>
              <summary className="cursor-pointer text-xs">변경 SQL · 계산식</summary>
              {proposal.preview.widgets.map((w, i) => (
                <pre key={i} className="text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {w.title}
                  {'\n'}
                  {w.sql}
                </pre>
              ))}
            </details>
            <div className="flex flex-row flex-wrap gap-2">
              <Button disabled={busy || saving || stale || disabled || saveConflict} onClick={() => apply()}>
                변경 적용
              </Button>
              <Button variant="ghost" disabled={saving} onClick={() => setProposal(null)}>
                미리보기 취소
              </Button>
            </div>
          </div>
        )}
        {undo && (
          <Button
            variant="ghost"
            className="mt-2"
            disabled={busy || saving || disabled || undoStale || saveConflict}
            onClick={() => apply(true)}
          >
            이전 변경 되돌리기
          </Button>
        )}
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-border p-5"
      >
        {(error || saveError) && (
          <Notice severity="error" className="mb-2 [overflow-wrap:anywhere]">
            {saveError || error?.message}
            {saveConflict && (
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => window.location.reload()}>
                최신 화면 불러오기
              </Button>
            )}
          </Notice>
        )}
        {disabled && (
          <Notice severity="info" className="mb-2">
            화면 조회를 완료한 뒤 질문할 수 있습니다.
          </Notice>
        )}
        <div className="mb-3 flex flex-row gap-2">
          <Button
            aria-pressed={mode === 'ask'}
            variant={mode === 'ask' ? 'default' : 'outline'}
            disabled={busy || saving}
            onClick={() => setMode('ask')}
          >
            질문
          </Button>
          <Button
            aria-pressed={mode === 'edit'}
            variant={mode === 'edit' ? 'default' : 'outline'}
            disabled={busy || saving}
            onClick={() => setMode('edit')}
          >
            대시보드 수정
          </Button>
        </div>
        <TextField
          id="assistant-input"
          inputRef={inputRef}
          className="w-full"
          label={mode === 'ask' ? '데이터에 질문하기' : '대시보드 수정 요청'}
          multiline
          rows={3}
          value={input}
          disabled={busy || saving}
          inputProps={{ maxLength: 2000 }}
          onChange={e => setInput(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">대화는 현재 화면에서만 유지됩니다.</p>
          {busy ? (
            <Button variant="ghost" onClick={() => stop()}>
              응답 중단
            </Button>
          ) : (
            <Button type="submit" disabled={saving || disabled || saveConflict || !input.trim()}>
              {saving ? '저장 중…' : mode === 'edit' ? '미리보기 요청' : '보내기'}
            </Button>
          )}
        </div>
      </form>
    </>
  );
  const assistantModal = useAssistantModal();
  const assistantPanel = assistantModal ? (
    <Sheet
      open={open}
      onOpenChange={next => {
        if (!next) close();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-label="LLM Assistant"
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none"
      >
        {panel(SheetTitle, SheetDescription)}
      </SheetContent>
    </Sheet>
  ) : (
    <aside
      role="complementary"
      aria-label="LLM Assistant"
      hidden={!open}
      className={cn(
        'fixed top-0 right-0 z-40 h-[100dvh] w-full min-w-0 flex-col border-l border-border bg-background shadow-none lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-[400px] [&[hidden]]:hidden',
        open ? 'flex' : 'hidden',
      )}
    >
      {panel('p', 'p')}
    </aside>
  );
  return (
    <>
      {metricEditor && (
        <MetricCalculationEditor
          open
          onClose={() => setMetricEditor(false)}
          metric={metrics.find(m => m.id === selectedMetricId)}
          selectedWidget={selectedWidget}
          draft={draft}
          dashboardId={dashboardId}
          filters={filters}
          dateRange={dateRange}
          trendGrain={trendGrain}
          comparePrevious={comparePrevious}
          onApplied={(next, updatedCount = 1) => {
            setProposal(null);
            setUndo(null);
            setSelectedMetricId('');
            setSelectedWidget('');
            setNotice(
              updatedCount > 1
                ? `${updatedCount}개 분석과 지표의 계산식을 변경했습니다.`
                : '지표와 분석의 계산식을 변경했습니다.',
            );
            onApplied(next);
          }}
        />
      )}
      {assistantPanel}
    </>
  );
}

export default function DashboardAssistant(props: any) {
  return (
    <AnalysisUiProvider>
      <DashboardAssistantContent {...props} />
    </AnalysisUiProvider>
  );
}
