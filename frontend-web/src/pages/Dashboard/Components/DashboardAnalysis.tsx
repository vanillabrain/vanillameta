import type { StudioConditions } from '../Studio/studioTypes';
import { responsiveBlockStyle } from '../responsiveBlockStyle';
import DashboardPivots from './DashboardPivots';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { get, post } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DashboardAssistant from './DashboardAssistant';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from './MetricTrend';
import { AnalysisUiProvider } from '@/components/analysis/AnalysisUi';
import PersonalSavedViews, {
  DateRange,
  FilterValue,
  RelativePeriod,
  SavedViewState,
  TrendGrain,
  resolveRelativePeriod,
  validDay,
} from './PersonalSavedViews';
import { PreviousPeriodData } from './PeriodComparison';
import SourceDetails, {
  ContributionRequest,
  validGroupFingerprint,
  validTrendPointContribution,
  validPreviousContributionRange,
  sameContributionDateRange,
} from './SourceDetails';
import { TimeSelection, timeRangeLabel, validTimeRange } from './timeSelection';
import { validateStudioFilters, validateStudioDateRange, validateStudioConditions } from '../Studio/studioDocument';
import { cn } from '@/lib/utils';

const valueKey = (value: FilterValue) => encodeURIComponent(JSON.stringify(value));
export type DefaultFilterParse =
  | { kind: 'none' }
  | { kind: 'filters'; filters: { column: string; values: FilterValue[] }[] }
  | { kind: 'invalid' };
/**
 * Server-owned default scope from the structured definition. Only an absent or empty list means
 * "no filters": a malformed list is authoritative and fails closed, so the screen never shows a
 * whole or partially filtered dataset while the saved scope is unknown.
 */
export const parseDefaultFilters = (input: unknown): DefaultFilterParse => {
  if (input === undefined) return { kind: 'none' };
  if (Array.isArray(input) && input.length === 0) return { kind: 'none' };
  try {
    return { kind: 'filters', filters: validateStudioFilters(input) as { column: string; values: FilterValue[] }[] };
  } catch {
    return { kind: 'invalid' };
  }
};
export const parseDefaultDateRange = (
  input: unknown,
): { kind: 'none' } | { kind: 'range'; dateRange: DateRange } | { kind: 'invalid' } => {
  if (input === undefined) return { kind: 'none' };
  try {
    return { kind: 'range', dateRange: validateStudioDateRange(input) };
  } catch {
    return { kind: 'invalid' };
  }
};
export const parseDefaultConditions = (
  input: unknown,
): { kind: 'none' } | { kind: 'conditions'; conditions: StudioConditions } | { kind: 'invalid' } => {
  if (input === undefined) return { kind: 'none' };
  try {
    return { kind: 'conditions', conditions: validateStudioConditions(input) };
  } catch {
    return { kind: 'invalid' };
  }
};
const displayedDates = (range: DateRange | null): DateRange =>
  range?.precision === 'timestamp'
    ? {
        column: range.column,
        start: range.start.slice(0, 10),
        end: new Date(Date.parse(range.end) - 1).toISOString().slice(0, 10),
      }
    : range ?? { column: '', start: '', end: '' };
type PeriodBackup = { dateRange: DateRange | null; relativePeriod: RelativePeriod | null; dateDraft: DateRange };
/** Saved per-width rects drive CSS custom properties, not a style-object cast. */
type StyleWithVars = React.CSSProperties & Record<`--${string}`, string>;
const responsiveBlockClassName =
  '[grid-row:var(--block-row-xs)] [grid-column:var(--block-col-xs)]' +
  ' [@media(min-width:600px)_and_(max-width:899.98px)]:[grid-row:var(--block-row-sm)]' +
  ' [@media(min-width:600px)_and_(max-width:899.98px)]:[grid-column:var(--block-col-sm)]' +
  ' [@media(min-width:900px)]:[grid-row:var(--block-row-md)]' +
  ' [@media(min-width:900px)]:[grid-column:var(--block-col-md)]';
const selectableTime = (selection: TimeSelection | undefined, length: number, dateRange: DateRange | null) =>
  selection &&
  (!dateRange || selection.column === dateRange.column) &&
  Array.isArray(selection.ranges) &&
  selection.ranges.length === length &&
  selection.ranges.some(range => validTimeRange(range) && range.column === selection.column);

/* Dense analysis control surface: 32px controls and 14px labels from the shared button scale. */
const analysisButtonClassName = 'shrink-0 font-medium';
const analysisOutlineButtonClassName = cn(analysisButtonClassName, 'bg-background');
const filterChipClassName =
  'min-h-8 max-w-full rounded-md border-primary/20 bg-primary/5 text-left text-xs text-primary [overflow-wrap:anywhere] hover:bg-primary/10';

function DashboardAnalysisContent({ dashboardId, revision, onSaved, onAssistantOpenChange, children }: any) {
  const { t } = useTranslation();
  const [numberNotation, setNumberNotation] = useState<SavedViewState['numberNotation']>('auto');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`dashboard-number-notation:${dashboardId}`);
      setNumberNotation(stored === 'full' || stored === 'compact' ? stored : 'auto');
    } catch {
      setNumberNotation('auto');
    }
  }, [dashboardId]);
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>({});
  const [dateDraft, setDateDraft] = useState<DateRange>({ column: '', start: '', end: '' });
  const [conditions, setConditions] = useState<StudioConditions | undefined>();
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [trendGrain, setTrendGrain] = useState<TrendGrain>('auto');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [relativePeriod, setRelativePeriod] = useState<RelativePeriod | null>(null);
  const [periodHistory, setPeriodHistory] = useState<PeriodBackup[]>([]);
  const periodRecovery = useRef<HTMLButtonElement>(null);
  const pendingTimeFocus = useRef<{
    dashboardId: unknown;
    range: string;
    afterRequest: number;
    button: Element;
    cancel: () => void;
  } | null>(null);
  const [recentDays, setRecentDays] = useState<7 | 30 | 90>(7);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contribution, setContribution] = useState<{ request: ContributionRequest; title: string } | null>(null);
  const detailsLauncher = useRef<Element | null>(null);
  const contributionButtons = useRef(new Map<number, HTMLButtonElement>());
  const contributionInteraction = useRef({ disabled: true, preview: null as any, periodKey: '' });
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [analysisRefresh, setAnalysisRefresh] = useState(0);
  const canonicalRefreshDone = useRef(0);
  const [categoryNotice, setCategoryNotice] = useState('');
  /** The saved common scope exists but cannot be read: the screen fails closed until it is resolved. */
  const [definitionError, setDefinitionError] = useState('');
  const [definitionRetry, setDefinitionRetry] = useState(0);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const assistantButton = useRef<HTMLButtonElement>(null);
  const serial = useRef(0);
  const completedPreview = useRef(0);
  const submittedPreview = useRef<{ filters: string; context: string } | null>(null);
  const pendingFocusIntent = useRef<{
    dashboardId: unknown;
    filters: string;
    afterRequest: number;
    button: HTMLButtonElement;
    cancel: () => void;
  } | null>(null);
  const loadedDashboard = useRef(null);
  const loadSerial = useRef(0);
  useEffect(() => {
    loadSerial.current += 1;
    const request = loadSerial.current;
    setAnalysisLoading(true);
    if (loadedDashboard.current !== dashboardId) {
      setDraft(null);
      setPreview(null);
      setFilters({});
      setDateDraft({ column: '', start: '', end: '' });
      setDateRange(null);
      setConditions(undefined);
      setTrendGrain('auto');
      setComparePrevious(false);
      setRelativePeriod(null);
      setPeriodHistory([]);
      setRecentDays(7);
      setDateError('');
      setDefinitionError('');
      setBusy(false);
      setError('');
      setEditing(false);
      setDetailsOpen(false);
      setContribution(null);
      detailsLauncher.current = null;
      setCategoryNotice('');
    }
    get(`/ai/dashboard-analysis/${dashboardId}`)
      .then(response => {
        if (request !== loadSerial.current) return;
        if (response.data.status === 'SUCCESS') {
          if (analysisRefresh && (typeof response.data.data?.revision !== 'string' || !response.data.data.revision.trim()))
            throw new Error('저장된 대시보드 정의의 버전을 확인할 수 없습니다. 다시 조회해 주세요.');
          const firstLoad = loadedDashboard.current !== dashboardId;
          const defaults = parseDefaultFilters(response.data.data?.defaultFilters);
          const defaultDateRange = parseDefaultDateRange(response.data.data?.defaultDateRange);
          const defaultConditions = parseDefaultConditions(response.data.data?.defaultConditions);
          if (
            Object.prototype.hasOwnProperty.call(response.data.data ?? {}, 'defaultConditions') &&
            response.data.data.defaultConditions === undefined
          )
            defaultConditions.kind = 'invalid';
          if (defaultConditions.kind === 'invalid' || defaults.kind === 'invalid' || defaultDateRange.kind === 'invalid') {
            // Never query an unverified scope: this screen keeps the saved definition authoritative
            // and offers a retry instead of rendering a whole or partially filtered dataset.
            canonicalRefreshDone.current = analysisRefresh;
            setDefinitionError(
              '저장된 날짜 범위·공통 필터 조건을 확인할 수 없습니다. 조건을 확인할 때까지 데이터를 조회하지 않습니다. 대시보드 정의를 다시 조회해 주세요.',
            );
            return;
          }
          canonicalRefreshDone.current = analysisRefresh;
          loadedDashboard.current = dashboardId;
          setDraft(response.data.data);
          setConditions(defaultConditions.kind === 'conditions' ? defaultConditions.conditions : undefined);
          setDefinitionError('');
          // The server-owned default scope applies on the first load of this dashboard only, and it
          // never overwrites a filter the user already chose (including one applied during the fetch).
          if (firstLoad && defaultDateRange.kind === 'range') {
            setDateRange(current => current ?? defaultDateRange.dateRange);
            setDateDraft(current => (current.start || current.end ? current : displayedDates(defaultDateRange.dateRange)));
          }
          if (firstLoad && defaults.kind === 'filters')
            setFilters(current =>
              Object.keys(current).length
                ? current
                : Object.fromEntries(defaults.filters.map(filter => [filter.column, filter.values])),
            );
        } else {
          throw new Error('저장된 대시보드 정의를 다시 읽지 못했습니다. 전체 데이터로 복구하거나 화면을 다시 열어 주세요.');
        }
        // Ordinary dashboards remain usable if their sources cannot support common filters.
      })
      .catch(cause => {
        if (
          request === loadSerial.current &&
          (cause?.response?.data?.code === 'INVALID_STUDIO_SCOPE' ||
            cause?.response?.data?.data?.code === 'INVALID_STUDIO_SCOPE')
        ) {
          canonicalRefreshDone.current = analysisRefresh;
          setDefinitionError(
            '저장된 날짜 범위·공통 필터 조건을 확인할 수 없습니다. 조건을 확인할 때까지 데이터를 조회하지 않습니다. 대시보드 정의를 다시 조회해 주세요.',
          );
          return;
        }
        if (request === loadSerial.current) {
          setDefinitionError('저장된 대시보드 정의를 다시 읽지 못했습니다. 화면을 다시 열어 주세요.');
          setBusy(false);
        }
        // Unsupported dashboards keep their standard viewer.
      })
      .finally(() => {
        if (request === loadSerial.current) setAnalysisLoading(false);
      });
    return () => {
      loadSerial.current += 1;
    };
  }, [dashboardId, revision, analysisRefresh, definitionRetry]);
  useEffect(() => {
    onAssistantOpenChange?.(editing);
  }, [editing, onAssistantOpenChange]);
  const previewFilterKey = JSON.stringify(
    Object.entries(filters)
      .filter(([, values]) => values.length)
      .slice(0, 5)
      .map(([column, values]) => ({ column, values: values.slice(0, 50) })),
  );
  useEffect(() => {
    if (
      !draft ||
      definitionError ||
      loadedDashboard.current !== dashboardId ||
      analysisLoading ||
      canonicalRefreshDone.current !== analysisRefresh
    )
      return;
    serial.current += 1;
    const request = serial.current;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const context = JSON.stringify([
      dashboardId,
      draft,
      dateRange,
      trendGrain,
      comparePrevious,
      previewRefresh,
      analysisRefresh,
    ]);
    const delay =
      submittedPreview.current?.context === context && submittedPreview.current.filters !== previewFilterKey ? 250 : 0;
    const run = () => {
      submittedPreview.current = { context, filters: previewFilterKey };
      post(
        '/ai/dashboard-view',
        {
          expectedRevision: draft.revision,
          dashboardId: Number(dashboardId),
          includeTrends: true,
          trendGrain,
          comparePrevious: comparePrevious && !!dateRange,
          filters: JSON.parse(previewFilterKey),
          ...(dateRange ? { dateRange } : {}),
          ...(conditions ? { conditions } : {}),
        },
        { timeout: 60000, signal: controller.signal },
      )
        .then(response => {
          if (request !== serial.current) return;
          if (response.data.status !== 'SUCCESS') throw new Error(response.data.message || '필터 조회 실패');
          completedPreview.current = request;
          setPreview(response.data.data);
        })
        .catch(e => {
          if (request !== serial.current || controller.signal.aborted) return;
          setError(e.response?.data?.message || e.message || '필터 조회 실패');
        })
        .finally(() => {
          if (request === serial.current) setBusy(false);
        });
    };
    const timer = delay ? setTimeout(run, delay) : undefined;
    if (!delay) run();
    return () => {
      serial.current += 1;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    draft,
    previewFilterKey,
    conditions,
    dateRange,
    dashboardId,
    trendGrain,
    comparePrevious,
    previewRefresh,
    analysisLoading,
    analysisRefresh,
    definitionError,
  ]);

  useEffect(() => () => pendingFocusIntent.current?.cancel(), []);
  useEffect(() => () => pendingTimeFocus.current?.cancel(), []);
  useEffect(() => {
    const intent = pendingTimeFocus.current;
    if (!intent) return;
    if (
      intent.dashboardId !== dashboardId ||
      intent.range !== JSON.stringify(dateRange) ||
      detailsOpen ||
      editing ||
      error
    ) {
      intent.cancel();
      return;
    }
    if (
      busy ||
      analysisLoading ||
      completedPreview.current !== serial.current ||
      completedPreview.current <= intent.afterRequest
    )
      return;
    const abandoned = document.activeElement === document.body;
    intent.cancel();
    // A surviving chart-table row keeps focus; only a removed focused row needs recovery.
    if (abandoned && !intent.button.isConnected && !document.querySelector('[role="dialog"]'))
      periodRecovery.current?.focus();
  }, [busy, analysisLoading, error, preview, dateRange, dashboardId, detailsOpen, editing]);
  useEffect(() => {
    const intent = pendingFocusIntent.current;
    if (!intent) return;
    if (
      intent.dashboardId !== dashboardId ||
      intent.filters !== JSON.stringify(filters) ||
      detailsOpen ||
      editing ||
      error
    ) {
      intent.cancel();
      return;
    }
    if (
      busy ||
      analysisLoading ||
      completedPreview.current !== serial.current ||
      completedPreview.current <= intent.afterRequest
    )
      return;
    const target = detailsButton.current;
    const abandoned = document.activeElement === document.body || document.activeElement === intent.button;
    intent.cancel();
    if (abandoned && target && !target.disabled && !document.querySelector('[role="dialog"]')) target.focus();
  }, [busy, analysisLoading, error, preview, filters, dashboardId, detailsOpen, editing]);
  if (!draft || definitionError) {
    contributionInteraction.current = { disabled: true, preview: null, periodKey: '' };
    // A malformed saved scope must not fall through to the ordinary viewer: that would show the
    // whole dataset under a dashboard whose common filters are unknown.
    if (definitionError)
      return (
        <Notice severity="warning" role="alert">
          {definitionError}
          {analysisLoading && <Skeleton role="progressbar" aria-label="분석 범위 다시 확인 중" className="h-2 w-full" />}
          <Button disabled={analysisLoading} onClick={() => setDefinitionRetry(value => value + 1)}>
            대시보드 정의 다시 조회
          </Button>
        </Notice>
      );
    return analysisLoading ? <Skeleton className="h-32 w-full" aria-label="분석 범위 확인 중" /> : <>{children}</>;
  }
  const dimensions = preview?.dimensions || [];
  const temporalColumns = preview?.temporalColumns || [];
  const temporalColumn = dateDraft.column || temporalColumns[0]?.column || '';
  const active = Object.entries(filters).filter(([, values]) => values.length);
  const displayedRange = displayedDates(dateRange);
  const unappliedDates =
    dateDraft.start !== displayedRange.start ||
    dateDraft.end !== displayedRange.end ||
    (!!dateDraft.column && dateDraft.column !== displayedRange.column);
  const viewDisabledReason =
    analysisLoading || busy
      ? '현재 조회가 완료된 뒤 저장 보기를 사용할 수 있습니다.'
      : error || dateError
      ? '조회 또는 날짜 오류를 해결한 뒤 저장 보기를 사용할 수 있습니다.'
      : unappliedDates
      ? '입력한 날짜를 적용하거나 초기화한 뒤 저장 보기를 사용할 수 있습니다.'
      : '';
  const detailsDisabledReason = viewDisabledReason.replace('저장 보기', '원본 상세');
  const contributionDisabled =
    !!viewDisabledReason ||
    editing ||
    detailsOpen ||
    typeof preview?.sourceRevision !== 'string' ||
    !preview.sourceRevision ||
    !draft.revision ||
    loadedDashboard.current !== dashboardId;

  const contributionReason = (widget: any) => {
    if (widget?.contribution?.supported !== true)
      return typeof widget?.contribution?.reason === 'string' && widget.contribution.reason.trim()
        ? widget.contribution.reason
        : '이 집계의 원본 행 조회는 지원하지 않습니다.';
    return widget.type !== 'BOARD_NUMERIC' && !validGroupFingerprint(widget.contribution.groupFingerprint)
      ? '집계 그룹 버전을 확인할 수 없습니다. 대시보드 데이터를 새로 조회해 주세요.'
      : '';
  };
  const openContribution = (widgetIndex: number, group?: { category: unknown }, launcher?: Element) => {
    const widget = preview?.widgets?.[widgetIndex];
    if (
      contributionInteraction.current.disabled ||
      contributionInteraction.current.preview !== preview ||
      !!contributionReason(widget) ||
      (group &&
        !(
          group.category === null ||
          typeof group.category === 'string' ||
          typeof group.category === 'boolean' ||
          (typeof group.category === 'number' && Number.isFinite(group.category))
        ))
    )
      return;
    detailsLauncher.current =
      launcher ||
      (document.activeElement !== document.body ? document.activeElement : contributionButtons.current.get(widgetIndex)) ||
      null;
    setContribution({
      request: {
        widgetIndex,
        expectedRevision: draft.revision,
        trendGrain,
        ...(widget.type !== 'BOARD_NUMERIC' ? { groupFingerprint: widget.contribution.groupFingerprint } : {}),
        ...(group ? { category: group.category as FilterValue } : {}),
      },
      title: widget.title,
    });
    setDetailsOpen(true);
  };
  const previousComparisonReady =
    !!comparePrevious &&
    sameContributionDateRange(preview?.comparison?.current, dateRange) &&
    validPreviousContributionRange(dateRange, preview?.comparison?.previous);
  const periodKey = JSON.stringify({ comparePrevious, dateRange, trendGrain, comparison: preview?.comparison });
  contributionInteraction.current = { disabled: !!contributionDisabled, preview, periodKey };
  const previousComparisonReason = previousComparisonReady ? '' : '이전 기간 비교를 적용한 뒤 조회해 주세요.';
  const trendContributionReason = (widget: any, period?: 'previous') => {
    const trend = period === 'previous' ? widget?.previousTrend : widget?.trend;
    if (period === 'previous' && !previousComparisonReady) return previousComparisonReason;
    if (widget?.type !== 'BOARD_NUMERIC' || trend?.contribution?.supported !== true)
      return typeof trend?.contribution?.reason === 'string' && trend.contribution.reason.trim()
        ? trend.contribution.reason
        : '이 추세 시점의 집계 원본 행 조회는 지원하지 않습니다.';
    return Array.isArray(trend.points) &&
      trend.points.some((point: any) =>
        validTrendPointContribution({
          column: trend.column,
          grain: trend.grain,
          time: point?.time,
          groupFingerprint: trend.contribution.groupFingerprint,
        }),
      )
      ? ''
      : '추세 시점 또는 그룹 버전을 확인할 수 없습니다. 대시보드 데이터를 새로 조회해 주세요.';
  };
  const openTrendContribution = (widgetIndex: number, time: string, period?: 'previous') => {
    const widget = preview?.widgets?.[widgetIndex];
    const trend = period === 'previous' ? widget?.previousTrend : widget?.trend;
    if (
      contributionInteraction.current.disabled ||
      contributionInteraction.current.preview !== preview ||
      (period === 'previous' && contributionInteraction.current.periodKey !== periodKey) ||
      !!trendContributionReason(widget, period) ||
      !trend.points.some((point: any) => point?.time === time)
    )
      return;
    const trendPoint = {
      column: trend.column,
      grain: trend.grain,
      time,
      groupFingerprint: trend.contribution.groupFingerprint,
    };
    if (!validTrendPointContribution(trendPoint)) return;
    detailsLauncher.current =
      (document.activeElement !== document.body ? document.activeElement : contributionButtons.current.get(widgetIndex)) ||
      null;
    setContribution({
      request: { widgetIndex, expectedRevision: draft.revision, trendGrain, trendPoint, ...(period ? { period } : {}) },
      title: widget.title,
    });
    setDetailsOpen(true);
  };
  const previousChartContributionReason = (widget: any) => {
    if (!previousComparisonReady) return previousComparisonReason;
    if (widget?.type !== 'CHART_LINE' || widget?.previousContribution?.supported !== true)
      return widget?.previousContribution?.reason || '이 차트의 이전 기간 원본 행 조회는 지원하지 않습니다.';
    const selection = widget.previousTimeSelection;
    return validGroupFingerprint(widget.previousContribution.groupFingerprint) &&
      ['hour', 'day', 'week', 'month'].includes(selection?.grain) &&
      Array.isArray(widget.previousDatas) &&
      selectableTime(selection, widget.previousDatas.length, null)
      ? ''
      : '이전 기간 시점 또는 그룹 버전을 확인할 수 없습니다. 대시보드 데이터를 새로 조회해 주세요.';
  };
  const openPreviousChartContribution = (widgetIndex: number, category: unknown) => {
    const widget = preview?.widgets?.[widgetIndex];
    if (
      contributionInteraction.current.disabled ||
      contributionInteraction.current.preview !== preview ||
      contributionInteraction.current.periodKey !== periodKey ||
      previousChartContributionReason(widget) ||
      !(
        category === null ||
        typeof category === 'string' ||
        typeof category === 'boolean' ||
        (typeof category === 'number' && Number.isFinite(category))
      ) ||
      !widget.previousDatas.some(
        (row: any) =>
          Object.prototype.hasOwnProperty.call(row, widget.categoryField) && Object.is(row[widget.categoryField], category),
      )
    )
      return;
    detailsLauncher.current = document.activeElement !== document.body ? document.activeElement : null;
    setContribution({
      request: {
        widgetIndex,
        expectedRevision: draft.revision,
        trendGrain,
        period: 'previous',
        category: category as FilterValue,
        groupFingerprint: widget.previousContribution.groupFingerprint,
      },
      title: widget.title,
    });
    setDetailsOpen(true);
  };
  const selectionDisabled = busy || analysisLoading || !!error || !!dateError;
  const timeSelectionDisabled = selectionDisabled || unappliedDates || editing || detailsOpen;
  const periodRecoveryDisabled = busy || analysisLoading || editing || detailsOpen || unappliedDates || !!dateError;
  const selectTime = (range: DateRange) => {
    if (timeSelectionDisabled || !validTimeRange(range) || (dateRange && range.column !== dateRange.column)) return;
    const button = document.activeElement;
    if (button instanceof Element && button !== document.body && typeof (button as HTMLElement).focus === 'function') {
      pendingTimeFocus.current?.cancel();
      const cancel = () => {
        document.removeEventListener('focusin', movedFocus, true);
        document.removeEventListener('keydown', cancel, true);
        document.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('blur', cancel);
        if (pendingTimeFocus.current?.cancel === cancel) pendingTimeFocus.current = null;
      };
      const movedFocus = (event: FocusEvent) => {
        if (event.target !== button && event.target !== document.body) cancel();
      };
      pendingTimeFocus.current = {
        dashboardId,
        range: JSON.stringify(range),
        afterRequest: serial.current,
        button,
        cancel,
      };
      document.addEventListener('focusin', movedFocus, true);
      document.addEventListener('keydown', cancel, true);
      document.addEventListener('pointerdown', cancel, true);
      window.addEventListener('blur', cancel);
    }
    setPeriodHistory(history => [...history.slice(-9), { dateRange, relativePeriod, dateDraft }]);
    setRelativePeriod(null);
    setDateRange({
      column: range.column,
      start: range.start,
      end: range.end,
      precision: 'timestamp',
      ...(range.timeZone ? { timeZone: range.timeZone } : {}),
    });
    setDateDraft(displayedDates(range));
    setDateError('');
    setBusy(true);
  };
  const restorePeriod = () => {
    if (periodRecoveryDisabled || !periodHistory.length) return;
    pendingTimeFocus.current?.cancel();
    const previous = periodHistory[periodHistory.length - 1];
    setPeriodHistory(history => history.slice(0, -1));
    setDateRange(previous.dateRange);
    setRelativePeriod(previous.relativePeriod);
    setDateDraft(previous.dateDraft);
    if (!previous.dateRange) setComparePrevious(false);
    setDateError('');
    setError('');
    setBusy(true);
  };
  const selectedValues = (column: string): FilterValue[] =>
    Object.prototype.hasOwnProperty.call(filters, column) && Array.isArray(filters[column]) ? filters[column] : [];
  const categoryLabel = (value: FilterValue) =>
    value === null
      ? '값 없음 (NULL)'
      : `${String(value)} (${typeof value === 'number' ? '숫자' : typeof value === 'boolean' ? '불리언' : '문자열'})`;
  const applyColumnValues = (column: string, values: FilterValue[], notice: string, allowPending = false) => {
    if (analysisLoading || !!error || !!dateError || (busy && !allowPending)) return;
    if (values.length > 50) {
      setCategoryNotice('한 컬럼에서 최대 50개 값까지 선택할 수 있습니다. 기존 값을 해제해 주세요.');
      return;
    }
    if (values.length && !selectedValues(column).length && active.length >= 5) {
      setCategoryNotice('공통 필터는 최대 5개 컬럼까지 선택할 수 있습니다. 기존 필터를 해제해 주세요.');
      return;
    }
    setFilters(current => ({ ...current, [column]: values }));
    setCategoryNotice(notice);
  };
  const toggleCategory = (column: string, value: unknown) => {
    if (
      selectionDisabled ||
      !(
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      )
    )
      return;
    const category = value as FilterValue;
    const selected = selectedValues(column);
    const exists = selected.some(item => valueKey(item) === valueKey(category));
    applyColumnValues(
      column,
      exists ? selected.filter(item => valueKey(item) !== valueKey(category)) : [...selected, category],
      `공통 필터 변경: ${column} · ${categoryLabel(category)} ${exists ? '해제' : '선택'}`,
    );
  };
  const rememberFocusAfterPreview = (button: HTMLButtonElement, nextFilters = filters) => {
    if (document.activeElement === button) {
      pendingFocusIntent.current?.cancel();
      const cancel = () => {
        document.removeEventListener('focusin', movedFocus, true);
        document.removeEventListener('keydown', cancel, true);
        document.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('blur', cancel);
        if (pendingFocusIntent.current?.cancel === cancel) pendingFocusIntent.current = null;
      };
      const movedFocus = (event: FocusEvent) => {
        if (event.target !== button && event.target !== document.body && event.target !== detailsButton.current) cancel();
      };
      pendingFocusIntent.current = {
        dashboardId,
        filters: JSON.stringify(nextFilters),
        afterRequest: serial.current,
        button,
        cancel,
      };
      document.addEventListener('focusin', movedFocus, true);
      document.addEventListener('keydown', cancel, true);
      document.addEventListener('pointerdown', cancel, true);
      window.addEventListener('blur', cancel);
    }
  };
  const clearCategoryChip = (button: HTMLButtonElement, column: string, value: FilterValue) => {
    if (selectionDisabled) return;
    const remaining = selectedValues(column).filter(item => valueKey(item) !== valueKey(value));
    rememberFocusAfterPreview(button, { ...filters, [column]: remaining });
    applyColumnValues(column, remaining, `공통 필터 변경: ${column} · ${categoryLabel(value)} 해제`);
  };
  const setNotation = (value: SavedViewState['numberNotation']) => {
    setNumberNotation(value);
    try {
      localStorage.setItem(`dashboard-number-notation:${dashboardId}`, value);
    } catch {
      /* Display remains usable without browser storage. */
    }
  };
  const viewState: SavedViewState = {
    version: 1,
    filters: active.map(([column, values]) => ({ column, values })),
    dateRange: relativePeriod ? null : dateRange,
    relativePeriod,
    numberNotation,
    trendGrain,
    comparePrevious: comparePrevious && !!dateRange,
  };
  const reset = () => {
    setPeriodHistory([]);
    pendingTimeFocus.current?.cancel();
    setFilters({});
    setCategoryNotice('공통 필터를 초기화했습니다.');
    setDateDraft({ column: '', start: '', end: '' });
    setDateRange(null);
    setRelativePeriod(null);
    setTrendGrain('auto');
    setComparePrevious(false);
    setDateError('');
  };
  const applyDates = () => {
    const { start, end } = dateDraft;
    setRelativePeriod(null);
    if (!start && !end) {
      setPeriodHistory([]);
      setDateError('');
      setDateRange(null);
      setComparePrevious(false);
      setTrendGrain('auto');
      setDateDraft({ column: '', start: '', end: '' });
      return;
    }
    if (!temporalColumn || !validDay(start) || !validDay(end) || start > end) {
      setDateError('시작일과 종료일을 올바르게 입력해 주세요. 시작일은 종료일 이전이어야 합니다.');
      return;
    }
    setDateError('');
    setPeriodHistory([]);
    setDateRange({ column: temporalColumn, start, end, ...(dateDraft.timeZone ? { timeZone: dateDraft.timeZone } : {}) });
  };
  const applyRecent = () => {
    if (busy || analysisLoading || error || !temporalColumn) return;
    const relative = {
      column: temporalColumn,
      days: recentDays,
      ...(dateDraft.timeZone ? { timeZone: dateDraft.timeZone } : {}),
    };
    const range = resolveRelativePeriod(relative);
    setPeriodHistory([]);
    setRelativePeriod(relative);
    setDateRange(range);
    setDateDraft(range);
    setDateError('');
  };
  const period = dateRange
    ? `${dateRange.column}: ${
        dateRange.precision === 'timestamp'
          ? timeRangeLabel(dateRange)
          : `${dateRange.start} ~ ${dateRange.end} (${dateRange.timeZone ?? 'UTC'})`
      }`
    : '전체 기간';
  const widgetGridClassName = cn(
    'grid gap-4',
    draft?.responsiveLayouts
      ? 'auto-rows-[minmax(80px,auto)] grid-cols-[repeat(4,minmax(0,1fr))] sm:grid-cols-[repeat(8,minmax(0,1fr))] md:grid-cols-[repeat(12,minmax(0,1fr))]'
      : draft?.blockLayouts
      ? 'md:auto-rows-[minmax(80px,auto)] md:grid-cols-[repeat(12,minmax(0,1fr))]'
      : 'md:grid-cols-[repeat(2,minmax(0,1fr))]',
    busy || error ? 'pointer-events-none opacity-40' : 'opacity-100',
  );
  /* Saved per-width rects (600/900 px contract) become CSS custom properties per block. */
  const widgetBlockRects = (index: number) =>
    responsiveBlockStyle(draft?.responsiveLayouts, draft?.widgets?.[index]?.blockId);
  const widgetBlockClassName = (index: number) => {
    const rects = widgetBlockRects(index);
    return rects.gridRow && rects.gridColumn ? responsiveBlockClassName : undefined;
  };
  const widgetBlockStyle = (index: number, widget: any): StyleWithVars => {
    const rects = widgetBlockRects(index);
    const minHeight = preview.draft?.layoutSizes?.[index]
      ? preview.draft.layoutSizes[index].height * 80 + 60
      : widget.type === 'BOARD_NUMERIC'
      ? 250
      : 460;
    if (rects.gridRow && rects.gridColumn) {
      return {
        minHeight,
        '--block-row-xs': rects.gridRow.xs,
        '--block-row-sm': rects.gridRow.sm,
        '--block-row-md': rects.gridRow.md,
        '--block-col-xs': rects.gridColumn.xs,
        '--block-col-sm': rects.gridColumn.sm,
        '--block-col-md': rects.gridColumn.md,
      };
    }
    const placed = draft?.blockLayouts?.[draft?.widgets?.[index]?.blockId];
    if (placed) {
      return {
        minHeight,
        gridRow: `${placed.y + 1} / span ${placed.h}`,
        gridColumn: `${placed.x + 1} / span ${placed.w}`,
      };
    }
    if (preview.draft?.layoutSizes?.[index]) {
      return { minHeight, gridColumn: preview.draft.layoutSizes[index].width === 12 ? '1 / -1' : 'auto' };
    }
    return { minHeight, gridColumn: widget.type === 'BOARD_NUMERIC' ? 'auto' : '1 / -1' };
  };
  return (
    <div className="min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex flex-row flex-wrap items-center gap-2">
        <p className="min-w-0 flex-[1_1_100%] text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {period} ·{' '}
          {active.length
            ? active.map(([column, values]) => `${column}: ${values.map(String).join(', ')}`).join(' · ')
            : '필터 없음'}
        </p>
        <Button
          ref={periodRecovery}
          variant="outline"
          size="sm"
          className={analysisButtonClassName}
          aria-disabled={periodRecoveryDisabled || !periodHistory.length}
          onClick={restorePeriod}
        >
          선택한 기간 되돌리기
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={analysisButtonClassName}
          onClick={reset}
          disabled={
            !active.length &&
            !dateRange &&
            !dateDraft.start &&
            !dateDraft.end &&
            !dateDraft.column &&
            trendGrain === 'auto' &&
            !comparePrevious
          }
        >
          필터 초기화
        </Button>
        <Button
          ref={detailsButton}
          variant="outline"
          size="sm"
          className={analysisOutlineButtonClassName}
          disabled={typeof preview?.sourceRevision !== 'string' || !preview.sourceRevision}
          aria-disabled={!!viewDisabledReason}
          onClick={() => {
            if (viewDisabledReason) return;
            detailsLauncher.current = detailsButton.current;
            setContribution(null);
            setDetailsOpen(true);
          }}
        >
          원본 상세 보기
        </Button>
        <Button
          ref={assistantButton}
          size="sm"
          className={analysisButtonClassName}
          aria-expanded={editing}
          onClick={() => setEditing(value => !value)}
        >
          Assistant
        </Button>
        <div className="flex min-w-0 flex-col gap-1.5 sm:ml-auto">
          <Label htmlFor="number-notation" className="sr-only">
            {t('settings.numberNotation')}
          </Label>
          <Select value={numberNotation} onValueChange={value => setNotation(value as SavedViewState['numberNotation'])}>
            <SelectTrigger
              id="number-notation"
              size="sm"
              aria-label={t('settings.numberNotation')}
              className="w-[150px] max-w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">위젯 설정</SelectItem>
              <SelectItem value="compact">{t('settings.numberCompact')}</SelectItem>
              <SelectItem value="full">{t('settings.numberFull')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div aria-label="적용된 공통 필터" role="group" className="mb-2 flex flex-row flex-wrap gap-2">
        {active.flatMap(([column, values]) =>
          values.map(value => (
            <Button
              key={`${column}:${valueKey(value)}`}
              variant="outline"
              size="sm"
              className={filterChipClassName}
              aria-disabled={selectionDisabled}
              aria-label={`${column}: ${categoryLabel(value)} 공통 필터 해제`}
              onClick={event => clearCategoryChip(event.currentTarget, column, value)}
            >
              {column}: {value === null ? '값 없음' : String(value)} ×
            </Button>
          )),
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn('text-xs text-muted-foreground [overflow-wrap:anywhere]', categoryNotice ? 'mb-3' : 'mb-0')}
      >
        {categoryNotice}
        {categoryNotice && (busy ? ' · 조회 중' : error ? ' · 조건 적용 실패' : ' · 조회 완료')}
      </p>
      <details className="mb-4 rounded-xl border border-border bg-background [&[open]>summary]:border-b [&[open]>summary]:border-border">
        <summary className="box-border flex min-h-9 cursor-pointer flex-wrap items-center gap-1 px-4 py-3 text-sm text-foreground [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="font-semibold">기간·필터 설정</span>
          <span className="ml-1 text-muted-foreground">
            {dateRange?.timeZone ?? 'UTC'} ·{' '}
            {({ auto: '자동 집계', day: '일별', week: '주별', month: '월별' } as Record<string, string>)[trendGrain]}
            {comparePrevious && dateRange ? ' · 이전 기간 비교' : ''}
            {unappliedDates ? ' · 날짜 입력 미적용' : ''}
          </span>
        </summary>
        <div className="p-4 sm:p-6">
          <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="business-time-zone">업무 시간대</Label>
              <Select
                value={dateDraft.timeZone ?? dateRange?.timeZone ?? 'UTC'}
                disabled={busy || analysisLoading || editing || detailsOpen}
                onValueChange={timeZone => {
                  setPeriodHistory([]);
                  setDateError('');
                  setDateDraft(value => ({ ...value, timeZone }));
                  if (relativePeriod) {
                    const relative = { ...relativePeriod, timeZone };
                    const range = resolveRelativePeriod(relative);
                    setRelativePeriod(relative);
                    setDateRange(range);
                    setDateDraft(range);
                  } else if (dateRange) setDateRange({ ...dateRange, timeZone });
                }}
              >
                <SelectTrigger id="business-time-zone" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Asia/Seoul">한국 (Asia/Seoul)</SelectItem>
                  {dateDraft.timeZone && !['UTC', 'Asia/Seoul'].includes(dateDraft.timeZone) && (
                    <SelectItem value={dateDraft.timeZone}>{dateDraft.timeZone}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {dimensions.slice(0, 5).map((dimension: any) => {
              const selected = selectedValues(dimension.column);
              const options: FilterValue[] = Array.from(
                new Map<string, FilterValue>(
                  [...selected, ...dimension.values.slice(0, 50)].map((value: FilterValue) => [valueKey(value), value]),
                ).values(),
              ).slice(0, 50);
              return (
                <div key={dimension.column} className="flex w-full min-w-0 flex-col gap-1.5">
                  <span id={`filter-${dimension.column}`} className="text-sm font-medium">
                    {dimension.column}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        id={`filter-${dimension.column}-trigger`}
                        aria-labelledby={`filter-${dimension.column}`}
                        disabled={analysisLoading || !!error || !!dateError}
                        className="w-full min-w-0 justify-between font-normal"
                      >
                        <span className="block truncate text-left">
                          {selected.length ? selected.map(String).join(', ') : '전체'}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[320px] w-[240px] overflow-y-auto">
                      {options.map(value => {
                        const checked = selected.some(item => valueKey(item) === valueKey(value));
                        return (
                          <DropdownMenuCheckboxItem
                            key={valueKey(value)}
                            checked={checked}
                            disabled={selected.length >= 50 && !checked}
                            onSelect={event => {
                              event.preventDefault();
                              applyColumnValues(
                                dimension.column,
                                checked ? selected.filter(item => valueKey(item) !== valueKey(value)) : [...selected, value],
                                `공통 필터 변경: ${dimension.column}`,
                                true,
                              );
                            }}
                          >
                            {String(value)}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
          <div className="mb-6 grid grid-cols-[minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[1.2fr_1.2fr_auto_1fr_auto]">
            {temporalColumns.length > 0 && (
              <>
                {temporalColumns.length > 1 ? (
                  <div className="flex min-w-0 max-w-full flex-[1_1_150px] flex-col gap-1.5">
                    <Label htmlFor="date-column">날짜 컬럼 (UTC)</Label>
                    <Select
                      value={temporalColumn}
                      disabled={busy}
                      onValueChange={value => {
                        setRelativePeriod(null);
                        setDateDraft(current => ({ ...current, column: value }));
                      }}
                    >
                      <SelectTrigger id="date-column" size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {temporalColumns.map((column: any) => (
                          <SelectItem key={column.column} value={column.column}>
                            {column.column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="col-span-full text-xs text-muted-foreground">날짜 기준 · {temporalColumn}</p>
                )}
                <TextField
                  className="min-w-0 max-w-full flex-[1_1_150px]"
                  label={`시작일 (${dateDraft.timeZone ?? 'UTC'})`}
                  type="date"
                  value={dateDraft.start}
                  disabled={busy}
                  onChange={e => {
                    setRelativePeriod(null);
                    setDateDraft(value => ({ ...value, start: e.target.value }));
                  }}
                />
                <TextField
                  className="min-w-0 max-w-full flex-[1_1_150px]"
                  label={`종료일 (${dateDraft.timeZone ?? 'UTC'})`}
                  type="date"
                  value={dateDraft.end}
                  disabled={busy}
                  onChange={e => {
                    setRelativePeriod(null);
                    setDateDraft(value => ({ ...value, end: e.target.value }));
                  }}
                />
                <Button variant="outline" className={analysisOutlineButtonClassName} onClick={applyDates} disabled={busy}>
                  적용
                </Button>
                <div className="flex min-w-0 max-w-full flex-[1_1_150px] flex-col gap-1.5">
                  <Label htmlFor="recent-days">최근 기간 ({dateDraft.timeZone ?? 'UTC'})</Label>
                  <Select
                    value={String(recentDays)}
                    disabled={busy}
                    onValueChange={value => setRecentDays(Number(value) as 7 | 30 | 90)}
                  >
                    <SelectTrigger id="recent-days" size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">최근 7일</SelectItem>
                      <SelectItem value="30">최근 30일</SelectItem>
                      <SelectItem value="90">최근 90일</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className={analysisOutlineButtonClassName}
                  disabled={busy || analysisLoading || !!error}
                  onClick={applyRecent}
                >
                  최근 기간 적용
                </Button>
              </>
            )}
          </div>
          <div className="mb-2 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 max-w-full flex-col gap-1.5">
              <Label htmlFor="trend-grain">시계열 집계 단위</Label>
              <Select
                value={trendGrain}
                disabled={analysisLoading}
                onValueChange={value => setTrendGrain(value as TrendGrain)}
              >
                <SelectTrigger id="trend-grain" size="sm" className="w-[160px] max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">자동</SelectItem>
                  <SelectItem value="day">일별</SelectItem>
                  <SelectItem value="week">주별</SelectItem>
                  <SelectItem value="month">월별</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-11 items-center gap-2">
              <Checkbox
                id="compare-previous"
                className="size-5"
                checked={comparePrevious}
                disabled={analysisLoading || !dateRange || unappliedDates || !!dateError}
                onCheckedChange={checked => setComparePrevious(checked === true)}
              />
              <Label htmlFor="compare-previous">이전 기간 비교</Label>
            </div>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="min-h-9 cursor-pointer text-xs">집계·기간 비교 안내</summary>
            <p className="mt-2 text-sm">
              {dateRange?.timeZone && dateRange.timeZone !== 'UTC'
                ? '업무 시간대는 KPI·원본 행·기간 비교에 적용됩니다. KPI 추이는 지역 달력의 일·주·월로 집계합니다. 주 시작은 월요일입니다. KPI 추이 시점을 선택해 기간을 좁히거나 해당 집계의 원본 행을 확인할 수 있습니다. 일반 라인 차트 재집계는 아직 지원하지 않습니다. 날짜 비교는 같은 달력 날짜 수를 사용합니다.'
                : '주별은 UTC 월요일 시작, 월별은 UTC 달력의 월 기준입니다. 선택 범위에 걸친 주·월은 범위 안의 데이터만 집계합니다.'}{' '}
              이전 기간은 적용된 기간 바로 앞의 같은 길이이며 동일한 필터로 조회합니다.
              {!dateRange && ' 이전 기간 비교는 날짜를 적용한 뒤 사용할 수 있습니다.'}
            </p>
          </details>
        </div>
      </details>
      {preview?.comparison && (
        <p role="status" className="mb-4 [overflow-wrap:anywhere]">
          {busy || error ? '이전 조회 결과의 비교 기간' : '이전 기간'}: {preview.comparison.previous.column} ·{' '}
          {preview.comparison.previous.precision === 'timestamp'
            ? timeRangeLabel(preview.comparison.previous)
            : `${preview.comparison.previous.start} ~ ${preview.comparison.previous.end} (${
                preview.comparison.previous.timeZone ?? 'UTC'
              })`}
        </p>
      )}
      {dateError && (
        <Notice severity="error" className="mb-4">
          {dateError}
        </Notice>
      )}
      {busy && <Skeleton role="progressbar" aria-label="공통 필터 집계 중" aria-busy="true" className="mb-4 h-1 w-full" />}
      {error && (
        <Notice severity="error" className="mb-4">
          {error}
          <p className="text-sm">아래는 이전 조회 결과입니다. 현재 선택 조건은 적용되지 않았습니다.</p>
          {canonicalRefreshDone.current !== analysisRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBusy(true);
                setError('');
                setAnalysisRefresh(value => value + 1);
              }}
            >
              대시보드 정의 다시 조회
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={reset}>
              전체 데이터로 복구
            </Button>
          )}
        </Notice>
      )}
      <details className="mb-4">
        <summary className="min-h-9 cursor-pointer text-sm">개인 저장 보기</summary>
        <div className="mt-2">
          <PersonalSavedViews
            key={`personal-views-${dashboardId}`}
            dashboardId={Number(dashboardId)}
            revision={draft.revision}
            state={viewState}
            disabledReason={viewDisabledReason}
            sourceRevision={preview?.sourceRevision}
            onApply={(state, range) => {
              if (!draft.revision || viewDisabledReason) return;
              serial.current += 1;
              setBusy(true);
              setError('');
              setDateError('');
              setFilters(Object.fromEntries(state.filters.map(filter => [filter.column, filter.values])));
              setPeriodHistory([]);
              pendingTimeFocus.current?.cancel();
              setDateRange(range);
              setDateDraft(displayedDates(range));
              setRelativePeriod(state.relativePeriod);
              setTrendGrain(state.trendGrain ?? 'auto');
              setComparePrevious(state.comparePrevious === true && !!range);
              if (state.relativePeriod) setRecentDays(state.relativePeriod.days);
              setNotation(state.numberNotation);
            }}
          />
        </div>
      </details>
      {preview ? (
        <div aria-busy={busy} className={widgetGridClassName}>
          {preview.widgets.map((widget: any, i: number) => (
            <Card
              key={draft?.widgets?.[i]?.blockId || i}
              data-block-id={draft?.widgets?.[i]?.blockId}
              className={cn('h-auto gap-0 border border-border py-0 shadow-sm', widgetBlockClassName(i))}
              style={widgetBlockStyle(i, widget)}
            >
              <div
                className={cn('min-w-0 px-4', widget.type === 'BOARD_NUMERIC' ? 'h-[155px]' : undefined)}
                style={
                  widget.type === 'BOARD_NUMERIC'
                    ? undefined
                    : {
                        height: preview.draft?.layoutSizes?.[i] ? preview.draft.layoutSizes[i].height * 80 + 60 : 460,
                      }
                }
              >
                <WidgetViewer
                  title={widget.title}
                  description={`${
                    busy || error
                      ? '이전 조회 결과 · 현재 선택 조건 미적용'
                      : active.length || dateRange
                      ? `${period} · 선택한 필터 적용`
                      : '전체 기간 · 필터 없음'
                  } · ${
                    widget.type === 'BOARD_NUMERIC'
                      ? widget.description?.replace(/전체 기간[^·]*· 필터 없음 · [\d,]+행/g, '원본 데이터 집계') || ''
                      : `${widget.datas.length}개 항목`
                  }`}
                  widgetType={widget.type}
                  widgetOption={analysisOptions(widget, numberNotation)}
                  dataSet={widget.datas}
                  timeSelection={widget.timeSelection}
                  onTimeSelect={
                    selectableTime(widget.timeSelection, widget.datas.length, dateRange) ? selectTime : undefined
                  }
                  timeSelectionDisabled={timeSelectionDisabled}
                  selectedTimeRange={dateRange}
                  onCategorySelect={
                    typeof widget.dimensionColumn === 'string' &&
                    widget.dimensionColumn &&
                    !temporalColumns.some((column: any) => column.column === widget.dimensionColumn)
                      ? value => toggleCategory(widget.dimensionColumn, value)
                      : undefined
                  }
                  selectedCategoryValues={
                    typeof widget.dimensionColumn === 'string' ? selectedValues(widget.dimensionColumn) : []
                  }
                  categorySelectionDisabled={selectionDisabled}
                  onContributionSelect={
                    widget.type !== 'BOARD_NUMERIC' && !contributionReason(widget)
                      ? category => openContribution(i, { category })
                      : undefined
                  }
                  contributionDisabled={!!contributionDisabled || !!contributionReason(widget)}
                />
              </div>
              {widget.contribution && (
                <details className="min-w-0 px-5 py-1">
                  <summary className="cursor-pointer text-xs">집계 원본 확인</summary>
                  <Button
                    ref={button => {
                      if (button) contributionButtons.current.set(i, button);
                      else contributionButtons.current.delete(i);
                    }}
                    variant="ghost"
                    className="max-w-full px-0 text-muted-foreground whitespace-normal [overflow-wrap:anywhere]"
                    aria-label={`${widget.title} 집계 원본 행 보기`}
                    aria-disabled={!!contributionDisabled || !!contributionReason(widget)}
                    disabled={!!contributionReason(widget) || !draft.revision || !preview.sourceRevision}
                    onClick={event => openContribution(i, undefined, event.currentTarget)}
                  >
                    집계 원본 행 보기
                  </Button>
                  {!!contributionReason(widget) && (
                    <p className="mt-2 text-sm [overflow-wrap:anywhere]">{contributionReason(widget)}</p>
                  )}
                </details>
              )}
              {widget.trendGrain && (
                <p className="px-5 text-xs">
                  적용된 집계 단위:{' '}
                  {({ day: '일별', week: '주별', month: '월별' } as Record<string, string>)[widget.trendGrain] ??
                    widget.trendGrain}{' '}
                  · UTC
                </p>
              )}
              {widget.grainUnavailable && (
                <Notice severity="warning" className="m-4">
                  선택한 집계 단위를 적용하지 못했습니다. {widget.grainUnavailable}
                </Notice>
              )}
              {widget.type === 'BOARD_NUMERIC' && (
                <MetricTrend
                  trend={widget.trend}
                  unavailable={widget.trendUnavailable}
                  title={widget.title}
                  prefix={widget.prefix}
                  decimalPlaces={widget.decimalPlaces ?? 0}
                  numberNotation={numberNotation === 'auto' ? widget.numberNotation || 'compact' : numberNotation}
                  comparison={widget.comparison}
                  previousTrend={widget.previousTrend}
                  periods={preview.comparison}
                  suffix={widget.suffix}
                  onTimeSelect={
                    selectableTime(widget.trend?.timeSelection, widget.trend?.points?.length, dateRange)
                      ? selectTime
                      : undefined
                  }
                  timeSelectionDisabled={timeSelectionDisabled}
                  selectedTimeRange={dateRange}
                  onContributionSelect={widget.trend?.contribution ? time => openTrendContribution(i, time) : undefined}
                  contributionDisabled={!!contributionDisabled || !!trendContributionReason(widget)}
                  contributionDisabledReason={
                    trendContributionReason(widget) ||
                    detailsDisabledReason ||
                    (editing ? '편집을 마친 뒤 조회해 주세요.' : '')
                  }
                />
              )}
              {widget.type === 'BOARD_NUMERIC' && (widget.previousTrend || widget.previousTrendUnavailable) && (
                <details className="min-w-0 p-4">
                  <summary className="flex min-h-9 cursor-pointer items-center text-sm">
                    {widget.title} 이전 기간 시계열
                  </summary>
                  {preview.comparison?.previous && (
                    <p className="text-sm [overflow-wrap:anywhere]">
                      이전 기간:{' '}
                      {preview.comparison.previous.precision === 'timestamp'
                        ? timeRangeLabel(preview.comparison.previous)
                        : `${preview.comparison.previous.start} ~ ${preview.comparison.previous.end} (${
                            preview.comparison.previous.timeZone ?? 'UTC'
                          })`}
                    </p>
                  )}
                  <MetricTrend
                    trend={widget.previousTrend}
                    unavailable={widget.previousTrendUnavailable}
                    title={`${widget.title} · 이전 기간`}
                    prefix={widget.prefix}
                    decimalPlaces={widget.decimalPlaces ?? 0}
                    numberNotation={numberNotation === 'auto' ? widget.numberNotation || 'compact' : numberNotation}
                    suffix={widget.suffix}
                    onContributionSelect={
                      widget.previousTrend?.contribution ? time => openTrendContribution(i, time, 'previous') : undefined
                    }
                    contributionDisabled={!!contributionDisabled || !!trendContributionReason(widget, 'previous')}
                    contributionDisabledReason={
                      trendContributionReason(widget, 'previous') ||
                      detailsDisabledReason ||
                      (editing ? '편집을 마친 뒤 조회해 주세요.' : '')
                    }
                  />
                </details>
              )}
              {widget.type !== 'BOARD_NUMERIC' && (Array.isArray(widget.previousDatas) || widget.previousUnavailable) && (
                <PreviousPeriodData
                  title={widget.title}
                  data={widget.previousDatas}
                  categoryField={widget.categoryField}
                  valueField={widget.valueField}
                  unavailable={widget.previousUnavailable}
                  onContributionSelect={
                    widget.type === 'CHART_LINE' && widget.previousContribution
                      ? category => openPreviousChartContribution(i, category)
                      : undefined
                  }
                  contributionDisabled={!!contributionDisabled || !!previousChartContributionReason(widget)}
                  contributionDisabledReason={
                    widget.type === 'CHART_LINE'
                      ? previousChartContributionReason(widget) || detailsDisabledReason
                      : undefined
                  }
                  period={
                    preview.comparison
                      ? preview.comparison.previous.precision === 'timestamp'
                        ? timeRangeLabel(preview.comparison.previous)
                        : `${preview.comparison.previous.start} ~ ${preview.comparison.previous.end}`
                      : undefined
                  }
                />
              )}
            </Card>
          ))}
        </div>
      ) : conditions ? (
        <Notice severity="info">포함·제외 조건의 미리보기 결과를 확인하는 중입니다. 원본 범위로 대체하지 않습니다.</Notice>
      ) : (
        // The saved analysis is authoritative. Mounting legacy widgets here would issue owner-only
        // raw data requests before this read-scoped aggregation finishes (or after it fails).
        <Skeleton className="h-32 w-full" aria-label="분석 결과 확인 중" />
      )}
      {conditions && (
        <Notice severity="info" role="note">
          포함·제외 조건 적용됨 · 저장된 분석 범위이며 읽기 전용입니다.
        </Notice>
      )}
      <DashboardPivots
        dashboardId={Number(dashboardId)}
        filters={active.map(([column, values]) => ({ column, values }))}
        dateRange={dateRange ?? undefined}
        conditions={conditions}
        paused={analysisLoading || busy || !!error || !!dateError || unappliedDates}
        onFilter={next =>
          setFilters(Object.fromEntries(next.filter(f => 'values' in f).map(f => [f.column, 'values' in f ? f.values : []])))
        }
      />
      {preview?.sourceRevision && (
        <SourceDetails
          key={`source-details-${dashboardId}`}
          open={detailsOpen}
          dashboardId={Number(dashboardId)}
          draft={draft}
          conditions={conditions}
          filters={active.map(([column, values]) => ({ column, values }))}
          dateRange={dateRange}
          comparePrevious={comparePrevious}
          previousDateRange={preview?.comparison?.previous}
          sourceRevision={preview?.sourceRevision}
          disabledReason={detailsDisabledReason}
          contribution={contribution?.request}
          widgetTitle={contribution?.title}
          onClose={() => setDetailsOpen(false)}
          onExited={() => {
            const launcher = detailsLauncher.current as HTMLElement | null;
            if (launcher?.isConnected && typeof launcher.focus === 'function' && !(launcher as HTMLButtonElement).disabled)
              launcher.focus();
            else detailsButton.current?.focus();
          }}
          onRefresh={() => {
            setDetailsOpen(false);
            if (contribution) {
              setBusy(true);
              setError('');
              setAnalysisRefresh(value => value + 1);
            } else setPreviewRefresh(value => value + 1);
          }}
        />
      )}
      <DashboardAssistant
        key={dashboardId}
        open={editing}
        onClose={() => {
          setEditing(false);
          assistantButton.current?.focus();
        }}
        dashboardId={Number(dashboardId)}
        draft={draft}
        conditions={conditions}
        filters={active.map(([column, values]) => ({ column, values }))}
        dateRange={dateRange}
        trendGrain={trendGrain}
        comparePrevious={comparePrevious && !!dateRange}
        disabled={busy || !!error}
        onApplied={next => {
          setNumberNotation('auto');
          try {
            localStorage.removeItem(`dashboard-number-notation:${dashboardId}`);
          } catch {
            /* Display remains usable without browser storage. */
          }
          const scope = parseDefaultConditions(next.defaultConditions);
          if (scope.kind === 'invalid' || (conditions && scope.kind !== 'conditions')) {
            setDefinitionError('저장된 포함·제외 조건을 확인할 수 없습니다. 다시 조회하세요.');
            return;
          }
          setConditions(scope.kind === 'conditions' ? scope.conditions : undefined);
          setDraft(next);
          setPeriodHistory([]);
          pendingTimeFocus.current?.cancel();
          onSaved(Number(dashboardId));
        }}
      />
    </div>
  );
}

export default function DashboardAnalysis(props: any) {
  return (
    <AnalysisUiProvider>
      <DashboardAnalysisContent {...props} />
    </AnalysisUiProvider>
  );
}
