import React, { useEffect, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MetricTrend from '@/pages/Dashboard/Components/MetricTrend';
import { formatMetric, metricNumericText } from '@/utils/formatMetric';
import { parseExploreViewState, type ExploreViewState, type ExploreDateRange, type ExploreFilter } from './exploreViewState';
import ExploreExport from './ExploreExport';
import PersonalSavedViews from '@/pages/Dashboard/Components/PersonalSavedViews';
import SegmentPivotDetails from './SegmentPivotDetails';
import PivotDashboardAdd from './PivotDashboardAdd';

type Measure = { id: number; label: string };
type Condition = { measureId: number; operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq'; value: string };
type MetricValue = { id: number; value: unknown };
export type SegmentResult = {
  viewRevision: string;
  sourceRevision: string;
  scope: { dimensionColumn: string; totalGroups: string | number; rows: string | number };
  kpis: Array<MetricValue & { label: string; unit: string; decimalPlaces: number }>;
  groups: Array<{ category: unknown; values: MetricValue[] }>;
  groupsTruncated: boolean;
  pivot?: {
    column: string;
    columns: Array<{ value: unknown; totals: MetricValue[] }>;
    rows: Array<{ category: unknown; cells: Array<{ column: unknown; values: MetricValue[] }> }>;
    truncatedColumns: boolean;
    columnLimit: number;
  };
  trends?: Array<{ time: string; values: MetricValue[] }>;
  trendsTruncated?: boolean;
  details: { rows: Record<string, unknown>[]; totalRows: string | number; page: number; pageSize: number };
};
const metricUnits = (unit: string) =>
  ['$', '€', '₩', '£', '¥'].includes(unit.trim())
    ? { prefix: unit.trim(), suffix: '' }
    : { prefix: '', suffix: unit.trim() === '%' ? '%' : unit.trim() ? ` ${unit.trim()}` : '' };

const OPERATORS = [
  ['gte', '이상 (≥)'],
  ['gt', '초과 (>)'],
  ['lte', '이하 (≤)'],
  ['lt', '미만 (<)'],
  ['eq', '같음 (=)'],
] as const;
const categoryText = (value: unknown) => (value === null ? '(값 없음)' : value === '' ? '(빈 문자열)' : String(value));
const cellText = (value: unknown) =>
  value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

function SegmentTable({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}

/** Separate explicit analysis scope: a group is qualified before its contributing rows are aggregated. */
export default function AggregateSegment({
  sourceId,
  sourceRevision,
  measures,
  dimensions,
  filters,
  dateRange,
  grain,
  paused,
  onReloadCatalog,
  catalogRevision,
  restoration,
  onRestore,
  onMutationPendingChange,
}: {
  sourceId: number;
  sourceRevision: string;
  measures: Measure[];
  dimensions: Array<{ column: string; numeric?: boolean; temporal?: boolean }>;
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  grain: 'day' | 'week' | 'month';
  paused: boolean;
  onReloadCatalog: () => void;
  catalogRevision?: string;
  restoration?: { nonce: number; state: ExploreViewState };
  onRestore?: (state: ExploreViewState) => void;
  onMutationPendingChange?: (pending: boolean) => void;
}) {
  const mutationCount = useRef(0);
  const [mutationBusy, setMutationBusy] = useState(false);
  const mutationChanged = (pending: boolean) => {
    mutationCount.current = Math.max(0, mutationCount.current + (pending ? 1 : -1));
    setMutationBusy(mutationCount.current > 0);
    onMutationPendingChange?.(mutationCount.current > 0);
  };
  const eligible = dimensions.filter(column => !column.numeric && !column.temporal);
  const [dimension, setDimension] = useState(eligible[0]?.column ?? '');
  const [selected, setSelected] = useState(measures.slice(0, 6).map(measure => measure.id));
  const [conditions, setConditions] = useState<Condition[]>([
    { measureId: measures[0]?.id ?? 0, operator: 'gte', value: '' },
  ]);
  const [result, setResult] = useState<SegmentResult | null>(null);
  const [pivotColumn, setPivotColumn] = useState('');
  const [savedOpen, setSavedOpen] = useState(false);
  const [resultKey, setResultKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!restoration?.state.segment) return;
    const settings = restoration.state.segment;
    generation.current += 1;
    controller.current?.abort();
    setResult(null);
    setResultKey('');
    setBusy(false);
    setDimension(settings.dimensionColumn);
    setSelected(restoration.state.measureIds);
    setConditions(settings.conditions.map(c => ({ ...c, value: String(c.value) })));
    setPivotColumn(settings.pivotColumn ?? '');
  }, [restoration?.nonce]);
  const queryKey = JSON.stringify({
    sourceId,
    sourceRevision,
    catalogRevision,
    dimension,
    selected,
    conditions,
    filters,
    dateRange,
    grain,
    paused,
    pivotColumn,
  });
  const exportQuery = {
    sourceId,
    sourceRevision,
    ...(catalogRevision ? { catalogRevision } : {}),
    dimensionColumn: dimension,
    ...(pivotColumn ? { pivotColumn } : {}),
    measureIds: selected,
    conditions: conditions.map(condition => ({ ...condition, value: Number(condition.value) })),
    filters,
    ...(dateRange ? { dateRange } : {}),
    trendGrain: grain,
    viewRevision: result?.viewRevision,
  };
  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    setResult(null);
    setBusy(false);
    setError('');
    setConflict(false);
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [queryKey]);
  const valid =
    !!dimension &&
    selected.length > 0 &&
    conditions.length > 0 &&
    conditions.every(
      condition =>
        selected.includes(condition.measureId) &&
        condition.value.trim() !== '' &&
        Number.isFinite(Number(condition.value)) &&
        Math.abs(Number(condition.value)) <= Number.MAX_SAFE_INTEGER,
    );
  const update = (index: number, patch: Partial<Condition>) =>
    setConditions(current => current.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  const run = async (page = 0) => {
    if (busy || !valid || paused) return;
    generation.current += 1;
    const token = generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setResult(null);
    setError('');
    try {
      const assertSession = captureAuthResponseFence();
      assertSession();
      const response = await post(
        '/bi/explore/segments',
        {
          sourceId,
          sourceRevision,
          ...(catalogRevision ? { catalogRevision } : {}),
          dimensionColumn: dimension,
          ...(pivotColumn ? { pivotColumn } : {}),
          measureIds: selected,
          conditions: conditions.map(condition => ({ ...condition, value: Number(condition.value) })),
          filters,
          ...(dateRange ? { dateRange } : {}),
          trendGrain: grain,
          page,
          pageSize: 20,
        },
        { signal: abort.signal },
      );
      if (generation.current !== token) return;
      assertSession();
      const next = response?.data?.data as SegmentResult;
      if (response?.data?.status !== 'SUCCESS' || !next || next.sourceRevision !== sourceRevision)
        throw new Error('invalid segment response');
      setResult(next);
      setResultKey(queryKey);
    } catch (failure) {
      if (generation.current !== token || abort.signal.aborted) return;
      const status = (failure as any)?.response?.status;
      setConflict(status === 409);
      setError(
        status === 409
          ? '데이터 또는 지표 정의가 변경되었습니다. 카탈로그를 다시 불러온 뒤 조회해 주세요.'
          : status === 403
          ? '이 소스의 집계 결과를 조회할 권한이 없습니다.'
          : '집계 조건을 조회하지 못했습니다. 조건을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      if (generation.current === token) setBusy(false);
    }
  };
  const metricText = (metric: SegmentResult['kpis'][number], value: unknown) =>
    formatMetric(value, {
      decimalPlaces: metric.decimalPlaces,
      ...metricUnits(metric.unit),
    }).text;
  const detailColumns = Object.keys(result?.details.rows[0] ?? {});
  const page = result?.details.page ?? 0;
  const totalRows = Number(result?.details.totalRows ?? 0);
  const savedState: ExploreViewState = {
    version: 1,
    mode: 'segment',
    segment: {
      dimensionColumn: dimension,
      conditions: conditions.map(c => ({ ...c, value: Number(c.value) })),
      ...(pivotColumn ? { pivotColumn } : {}),
    },
    measureIds: selected,
    dimensionColumns: [dimension],
    rankingMeasureId: selected[0] ?? 0,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters,
    dateRange: dateRange ?? null,
    relativePeriod: null,
    trendGrain: grain,
    comparePrevious: false,
    includeRows: false,
  };
  return (
    <section aria-label="집계 조건 탐색" className="mt-4 min-w-0 space-y-4">
      {catalogRevision && onRestore && (
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" disabled={mutationBusy} aria-expanded={savedOpen} onClick={() => setSavedOpen(v => !v)}>
            집계 조건 저장 보기
          </Button>
          {savedOpen && (
            <PersonalSavedViews<ExploreViewState>
              endpoint={`/bi/explore/${sourceId}/views`}
              subject="explore"
              parseState={parseExploreViewState}
              revision={catalogRevision}
              sourceRevision={sourceRevision}
              state={savedState}
              disabledReason={
                mutationBusy
                  ? '저장 결과를 확인하는 중입니다.'
                  : paused
                  ? '기간 입력을 완성한 뒤 저장 보기를 불러와 주세요.'
                  : ''
              }
              onMutationPendingChange={mutationChanged}
              saveDisabledReason={
                !result || busy || paused || resultKey !== queryKey ? '현재 집계 조건을 적용한 뒤 저장해 주세요.' : ''
              }
              onApply={onRestore}
              renderViewAction={view =>
                view.state.mode === 'segment' && view.state.segment?.pivotColumn ? (
                  <PivotDashboardAdd
                    sourceId={sourceId}
                    viewId={view.id}
                    name={view.name}
                    disabled={mutationBusy}
                    onMutationPendingChange={mutationChanged}
                  />
                ) : null
              }
            />
          )}
          {restoration?.state.segment && (
            <p role="status" className="text-xs text-muted-foreground">
              저장한 집계 조건을 복원했습니다. 현재 파일로 확인하려면 집계 조건 적용을 누르세요.
            </p>
          )}
        </div>
      )}
      <Card className="min-w-0 gap-4 p-4 sm:p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">집계 결과로 대상 찾기</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            위의 기간·원본 필터를 적용한 뒤 대상별 지표를 계산합니다. 모든 조건을 통과한 대상의 원본 행으로 합계·추세·상세를
            다시 계산합니다. 비율의 분모가 0인 대상은 비교 조건을 통과하지 않습니다.
          </p>
        </div>
        <TextField
          select
          label="집계 대상"
          value={dimension}
          onChange={event => {
            setDimension(event.target.value);
            if (event.target.value === pivotColumn) setPivotColumn('');
          }}
          className="max-w-sm"
        >
          <option value="">차원을 선택하세요</option>
          {eligible.map(column => (
            <option key={column.column} value={column.column}>
              {column.column}
            </option>
          ))}
        </TextField>
        <TextField
          select
          label="집계 Pivot 열"
          value={pivotColumn}
          onChange={e => setPivotColumn(e.target.value)}
          className="max-w-sm"
        >
          <option value="">대상별 요약</option>
          {eligible
            .filter(c => c.column !== dimension)
            .map(c => (
              <option key={c.column} value={c.column}>
                {c.column}
              </option>
            ))}
        </TextField>
        <fieldset className="min-w-0 rounded-lg border p-3">
          <legend className="px-1 text-[13px] font-medium">계산할 지표 · 최대 6개</legend>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {measures.map(measure => (
              <label key={measure.id} className="flex min-h-9 min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(measure.id)}
                  disabled={!selected.includes(measure.id) && selected.length >= 6}
                  onCheckedChange={checked => {
                    setSelected(current => (checked ? [...current, measure.id] : current.filter(id => id !== measure.id)));
                  }}
                />
                <span className="break-words">{measure.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-3" role="group" aria-label="모든 집계 조건">
          {conditions.map((condition, index) => (
            <div
              key={index}
              className="grid min-w-0 items-end gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <TextField
                select
                label={`조건 ${index + 1} 지표`}
                value={condition.measureId}
                onChange={event => update(index, { measureId: Number(event.target.value) })}
              >
                {!selected.includes(condition.measureId) && <option value={condition.measureId}>지표를 선택하세요</option>}
                {measures
                  .filter(measure => selected.includes(measure.id))
                  .map(measure => (
                    <option key={measure.id} value={measure.id}>
                      {measure.label}
                    </option>
                  ))}
              </TextField>
              <TextField
                select
                label={`조건 ${index + 1} 비교`}
                value={condition.operator}
                onChange={event => update(index, { operator: event.target.value as Condition['operator'] })}
              >
                {OPERATORS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </TextField>
              <TextField
                label={`조건 ${index + 1} 기준값`}
                type="number"
                step="any"
                value={condition.value}
                onChange={event => update(index, { value: event.target.value })}
              />
              <Button
                variant="ghost"
                disabled={conditions.length === 1}
                aria-label={`조건 ${index + 1} 삭제`}
                onClick={() => setConditions(current => current.filter((_, i) => i !== index))}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={conditions.length >= 3 || selected.length === 0}
            onClick={() => setConditions(current => [...current, { measureId: selected[0], operator: 'lt', value: '' }])}
          >
            조건 추가
          </Button>
          <Button disabled={busy || paused || !valid} onClick={() => void run()}>
            집계 조건 적용
          </Button>
          <p className="text-xs text-muted-foreground">
            % 지표는 20%를 20으로 입력합니다. 집계 Pivot 열을 선택하면 같은 대상의 교차표를 계산합니다. 집계 조건 저장 보기와
            표시 집계 CSV에서 이 조건을 재사용하세요.
          </p>
        </div>
        {paused && <Notice severity="info">기간 입력을 완성한 뒤 집계 조건을 적용해 주세요.</Notice>}
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            현재 조건으로 대상과 원본 행을 확인하는 중…
          </p>
        )}
        {error && (
          <Notice severity="error">
            <span>{error}</span>
            {conflict && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={onReloadCatalog}>
                  카탈로그 다시 불러오기
                </Button>
                <span className="text-xs">데이터를 다시 불러오면 탐색 조건이 초기화됩니다.</span>
              </div>
            )}
          </Notice>
        )}
      </Card>
      {result && (
        <>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <p role="status" className="min-w-0 break-words py-2 text-sm font-medium">
              조건에 맞는 대상 {result.scope.totalGroups}개 · 원본 {result.details.totalRows}행 ·{' '}
              {result.scope.dimensionColumn} 기준
            </p>
            <ExploreExport
              payload={{ mode: 'segment', query: exportQuery }}
              disabled={busy || paused || resultKey !== queryKey || !result.viewRevision}
            />
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.kpis.map(metric => (
              <Card key={metric.id} className="min-w-0 gap-3 p-4">
                <h3 className="text-sm font-medium">{metric.label}</h3>
                <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{metricText(metric, metric.value)}</p>
                {(result.trends?.length ?? 0) > 0 && (
                  <MetricTrend
                    title={metric.label}
                    decimalPlaces={metric.decimalPlaces}
                    {...metricUnits(metric.unit)}
                    trend={{
                      column: dimension,
                      grain,
                      timeZone: 'UTC',
                      points: (result.trends ?? []).map(point => ({
                        time: point.time,
                        value: metricNumericText(point.values.find(value => value.id === metric.id)?.value),
                      })),
                    }}
                  />
                )}
              </Card>
            ))}
          </div>
          {result.trendsTruncated && (
            <p className="text-xs text-muted-foreground">
              추세는 앞 200개 시점까지 표시합니다. 전체 합계는 모든 행을 계산합니다.
            </p>
          )}
          <SegmentPivotDetails result={result} query={exportQuery} metricText={metricText} />
          <Card className="min-w-0 gap-3 p-4">
            <p className="text-xs text-muted-foreground sm:hidden">표를 가로로 스크롤하면 나머지 지표를 볼 수 있습니다.</p>
            <SegmentTable label="대상별 집계 표">
              <TableCaption>
                조건에 맞는 대상별 집계{result.groupsTruncated ? ' · 앞 50개 표시, 전체 합계는 모든 대상 포함' : ''}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{dimension}</TableHead>
                  {result.kpis.map(metric => (
                    <TableHead key={metric.id} className="text-right">
                      {metric.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.groups.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell className="max-w-64 break-words whitespace-normal">{categoryText(group.category)}</TableCell>
                    {result.kpis.map(metric => (
                      <TableCell key={metric.id} className="text-right tabular-nums">
                        {metricText(metric, group.values.find(value => value.id === metric.id)?.value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </SegmentTable>
            {result.groups.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                조건에 맞는 대상이 없습니다. 기준값이나 기간을 조정해 주세요.
              </p>
            )}
          </Card>
          <Card className="min-w-0 gap-3 p-4">
            <h3 className="mb-3 text-sm font-semibold">선택 대상에 기여한 원본 행</h3>
            <SegmentTable label="기여한 원본 행 표">
              <TableCaption>
                원본 {result.details.totalRows}행 · 페이지 {page + 1}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {detailColumns.map(column => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.details.rows.map((row, index) => (
                  <TableRow key={index}>
                    {detailColumns.map(column => (
                      <TableCell key={column} className="max-w-64 break-words whitespace-normal">
                        {cellText(row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </SegmentTable>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" disabled={busy || page === 0} onClick={() => void run(page - 1)}>
                이전 원본 행
              </Button>
              <Button
                variant="outline"
                disabled={busy || (page + 1) * result.details.pageSize >= totalRows}
                onClick={() => void run(page + 1)}
              >
                다음 원본 행
              </Button>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
