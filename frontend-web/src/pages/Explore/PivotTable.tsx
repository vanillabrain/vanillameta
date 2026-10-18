import type { StudioConditions } from '../Dashboard/Studio/studioTypes';
import { validateStudioConditions } from '../Dashboard/Studio/studioDocument';
import { get } from '@/helpers/apiHelper';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField } from '@/components/ui/text-field';
import { acquirePivotRequest, type PivotRequestPool } from './pivotRequests';
import { formatMetric, metricNumericText } from '@/utils/formatMetric';
import type { ExploreDateRange, ExploreFilter, PivotAxes } from './exploreViewState';

import { pivotCsv, pivotRequestKey } from './pivotCsv';

type Axis = { key: string; values: unknown[]; totals: unknown[] };
type PivotRow = Axis & { cells: { columnKey: string; values: unknown[] }[] };
type Metric = {
  id: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces: number;
  numberNotation?: string;
};
export type PivotResult = {
  sourceRevision: string;
  metrics: Metric[];
  rows: PivotRow[];
  columns: Axis[];
  grandTotals: unknown[];
  limits: {
    rowLimit: number;
    columnLimit: number;
    totalRowGroups: number | string;
    totalColumnGroups: number | string;
    truncatedRows: boolean;
    truncatedColumns: boolean;
  };
};
type Props = {
  canExport?: boolean;
  sourceId: number;
  sourceRevision: string;
  dimensions: { column: string; temporal?: boolean }[];
  measureIds: number[];
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  conditions?: StudioConditions;
  paused: boolean;
  pauseReason?: string;
  fixedAxes?: boolean;
  embedded?: boolean;
  requestPool?: PivotRequestPool;
  filterDelayMs?: number;
  axes?: PivotAxes;
  onAxesChange?: (axes: PivotAxes) => void;
  onReady?: (status: { key: string; reason: string }) => void;
  onFilter: (filters: ExploreFilter[]) => void;
  onReloadCatalog: () => void;
};
const category = (v: unknown) => (v === null ? '(NULL)' : v === '' ? '(빈 문자열)' : String(v));
const errorMessage = (err: any) => {
  if (err?.response?.status === 429) return '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.';
  const message = err?.response?.data?.data?.message;
  return typeof message === 'string' ? message : 'Pivot을 불러오지 못했습니다. 다시 시도해 주세요.';
};
export default function PivotTable(props: Props) {
  const fields = props.dimensions.filter(d => !d.temporal);
  const [localRow1, setRow1] = useState(fields.find(d => d.column === 'device_type')?.column ?? fields[0]?.column ?? '');
  const [localRow2, setRow2] = useState('');
  const [localColumn, setColumn] = useState('');
  const row1 = props.axes ? props.axes.rowDimensions[0] ?? '' : localRow1;
  const row2 = props.axes ? props.axes.rowDimensions[1] ?? '' : localRow2;
  const column = props.axes ? props.axes.columnDimensions[0] ?? '' : localColumn;
  const changeAxes = (a: string, b: string, c: string) => {
    if (props.onAxesChange) props.onAxesChange({ rowDimensions: [a, b].filter(Boolean), columnDimensions: c ? [c] : [] });
    else {
      setRow1(a);
      setRow2(b);
      setColumn(c);
    }
  };
  const [resultKey, setResultKey] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<PivotResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const generation = useRef(0);
  const exportGeneration = useRef(0);
  useEffect(() => {
    exportGeneration.current += 1;
    return () => {
      exportGeneration.current += 1;
    };
  }, [props.canExport]);
  const localPool = useRef<PivotRequestPool>(new Map());
  const rowDimensions = [row1, row2].filter(Boolean);
  const invalid =
    !row1 || new Set([...rowDimensions, column].filter(Boolean)).size !== rowDimensions.length + Number(!!column);
  let conditions: StudioConditions | undefined;
  let conditionError = '';
  try {
    if (props.conditions !== undefined) conditions = validateStudioConditions(props.conditions);
  } catch {
    conditionError = '포함·제외 조건을 확인하지 못했습니다. 조건 없는 결과로 대체하지 않습니다.';
  }
  const paused = !!conditionError || props.paused || !props.measureIds.length || invalid;
  const requestKey = pivotRequestKey({
    sourceId: props.sourceId,
    sourceRevision: props.sourceRevision,
    measureIds: props.measureIds,
    rowDimensions,
    columnDimensions: column ? [column] : [],
    filters: props.filters,
    dateRange: props.dateRange,
    ...(conditions ? { conditions } : {}),
  });
  const currentRequestKey = useRef(requestKey);
  currentRequestKey.current = requestKey;
  const filterKey = JSON.stringify(props.filters);
  const previousFilters = useRef(filterKey);
  const current = !!result && resultKey === requestKey && !paused && !busy && !error;
  useEffect(() => {
    props.onReady?.({ key: requestKey, reason: current ? '' : error || '현재 Pivot 조건을 조회한 뒤 저장해 주세요.' });
  }, [props.onReady, requestKey, current, error]);
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    const delay = previousFilters.current !== filterKey ? props.filterDelayMs ?? 0 : 0;
    setResult(null);
    setExportNotice('');
    setError('');
    setConflict(false);
    if (paused) {
      setBusy(false);
      return () => {
        generation.current += 1;
      };
    }
    setBusy(true);
    let subscription: ReturnType<typeof acquirePivotRequest> | undefined;
    const run = () => {
      previousFilters.current = filterKey;
      subscription = acquirePivotRequest(props.requestPool ?? localPool.current, requestKey, {
        sourceId: props.sourceId,
        sourceRevision: props.sourceRevision,
        measureIds: props.measureIds,
        rowDimensions: [row1, row2].filter(Boolean),
        columnDimensions: column ? [column] : [],
        filters: props.filters,
        ...(props.dateRange ? { dateRange: props.dateRange } : {}),
        ...(conditions ? { conditions } : {}),
      });
      void subscription.promise
        .then(response => {
          if (generation.current !== token || abort.signal.aborted) return;
          if (response.data?.status !== 'SUCCESS' || response.data.data?.sourceRevision !== props.sourceRevision)
            throw new Error('invalid Pivot response');
          setResult(response.data.data);
          setResultKey(requestKey);
        })
        .catch(err => {
          if (generation.current !== token || abort.signal.aborted) return;
          setError(errorMessage(err));
          setConflict(err?.response?.status === 409);
        })
        .finally(() => {
          if (generation.current === token) setBusy(false);
        });
    };
    const timer = delay ? window.setTimeout(run, delay) : undefined;
    if (!delay) run();
    return () => {
      generation.current += 1;
      abort.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      subscription?.release();
    };
  }, [requestKey, paused, reload, props.requestPool, props.filterDelayMs]);
  const downloadCsv = async () => {
    if (!current || props.canExport === false) return;
    const exportRequest = exportGeneration.current;
    const requestGeneration = generation.current;
    try {
      // A visible download control is not authority; current server permission is checked again.
      // canExport is an optional UI hint, including for embedded dashboards. Its absence
      // never bypasses current source authorization, and no permission is cached across downloads.
      const response = await get(`/enterprise/resources/source/${props.sourceId}/access`);
      if (response?.data?.rights?.export !== true) throw new Error('export denied');
      if (generation.current !== requestGeneration || exportGeneration.current !== exportRequest) return;
      if (currentRequestKey.current !== requestKey || generation.current !== requestGeneration) return;
      const blob = new Blob([pivotCsv(result, { rowDimensions, columnDimensions: column ? [column] : [] })], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pivot-source-${props.sourceId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice('Pivot CSV를 내보냈습니다. 숫자는 축약·반올림하지 않은 집계값입니다.');
    } catch {
      setExportNotice('CSV를 만들지 못했습니다. 다시 시도해 주세요.');
    }
  };
  const options = (excluded: string[]) =>
    fields.map(d => (
      <option key={d.column} value={d.column} disabled={excluded.includes(d.column)}>
        {d.column}
      </option>
    ));
  const text = (value: unknown, metric: Metric) => {
    const options = {
      prefix: metric.prefix,
      suffix: metric.suffix,
      decimalPlaces: metric.decimalPlaces,
      numberNotation: metric.numberNotation === 'compact' ? ('compact' as const) : ('full' as const),
    };
    const formatted = formatMetric(value, options);
    // Compact integer measures need one decimal to distinguish e.g. 23.9M from 24M.
    // Only the abbreviated display changes; exact values and saved metric precision remain intact.
    const raw = metricNumericText(value);
    if (options.numberNotation === 'compact' && metric.decimalPlaces === 0 && raw && Math.abs(Number(raw)) >= 1000)
      formatted.text = formatMetric(value, { ...options, decimalPlaces: 1 }).text;
    return formatted;
  };
  const applyAxis = (names: string[], values: unknown[]) => {
    const next = props.filters.filter(f => !names.includes(f.column));
    names.forEach((name, i) => next.push({ column: name, values: [values[i] as string | number | boolean | null] }));
    if (next.length > 5) {
      setError('필터는 최대 5개 열까지 적용할 수 있습니다. 기존 필터를 해제하세요.');
      return;
    }
    props.onFilter(next);
  };
  const valueCell = (value: unknown, metric: Metric, key: string, missing = false) => {
    const formatted = text(value, metric);
    return (
      <TableCell
        key={key}
        title={missing ? '원본에 이 조합의 행이 없습니다.' : formatted.exactText}
        aria-label={missing ? '조합 없음' : formatted.exactText}
        className="border-b px-2 py-1 text-right whitespace-nowrap md:py-0.5"
      >
        {missing ? '조합 없음' : formatted.text}
      </TableCell>
    );
  };
  return (
    <section aria-label="Pivot 탐색" className="mt-4 min-w-0">
      {conditions && (
        <p role="note" className="min-w-0 break-words text-sm">
          포함·제외 조건 적용됨 · 읽기 전용
        </p>
      )}
      {conditionError && (
        <Notice severity="warning" role="alert">
          {conditionError}
        </Notice>
      )}
      {!props.embedded && <h2 className="text-lg font-semibold">Pivot</h2>}
      <p className="mt-1 mb-3 text-sm text-muted-foreground">행·열 차원별 교차 분석 · 현재 기간과 공통 필터 적용</p>
      {props.embedded ? (
        <p className="mb-2 text-sm">
          행 {rowDimensions.join(' / ')} {column ? `× 열 ${column}` : '· 지표만 표시'}
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
          <TextField
            select
            disabled={props.fixedAxes}
            label="Pivot 행 차원"
            value={row1}
            onChange={e => changeAxes(e.target.value, row2, column)}
            className="min-w-0 md:w-[220px]"
          >
            {options([row2, column])}
          </TextField>
          <TextField
            select
            disabled={props.fixedAxes}
            label="Pivot 두 번째 행 차원"
            value={row2}
            onChange={e => changeAxes(row1, e.target.value, column)}
            className="min-w-0 md:w-[220px]"
          >
            <option value="">추가 차원 없음</option>
            {options([row1, column])}
          </TextField>
          <TextField
            select
            disabled={props.fixedAxes}
            label="Pivot 열 차원"
            value={column}
            onChange={e => changeAxes(row1, row2, e.target.value)}
            className="min-w-0 md:w-[220px]"
          >
            <option value="">지표만 표시</option>
            {options([row1, row2])}
          </TextField>
          <Button
            variant="ghost"
            disabled={props.fixedAxes || !column || !!row2}
            onClick={() => {
              changeAxes(column, '', row1);
            }}
          >
            행·열 바꾸기
          </Button>
        </div>
      )}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
        <Button variant="outline" disabled={!current || props.canExport === false} onClick={() => void downloadCsv()}>
          Pivot CSV 내보내기
        </Button>
        <p className="text-xs text-muted-foreground">
          표시된 그룹과 전체 합계를 정확한 숫자로 내보냅니다. 제한된 그룹은 CSV의 export_scope에 명시합니다.
        </p>
      </div>
      <p role="status" aria-live="polite">
        {exportNotice}
      </p>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary>정렬·합계·표시 범위 안내</summary>첫 지표의 전체 값 내림차순 · 최대 50행 × 12열 그룹. 전체 합계는 원본에서
        다시 계산합니다. 행·열 이름으로 해당 값을 필터링할 수 있습니다. 비교 기간·시간 집계 축은 아직 지원하지 않습니다.
      </details>
      <p role="status" aria-live="polite" className="my-2 min-h-8 md:min-h-6">
        {busy
          ? 'Pivot 집계 중…'
          : paused
          ? props.pauseReason || '완성한 기간과 지표·행 차원을 선택하세요.'
          : result
          ? `Pivot ${result.rows.length}행 · ${result.columns.length}열 그룹 적용됨`
          : ''}
      </p>
      {error && (
        <Notice severity="error" className="flex flex-wrap items-center gap-2">
          <span className="break-words">{error}</span>
          <Button variant="ghost" onClick={conflict ? props.onReloadCatalog : () => setReload(v => v + 1)}>
            {conflict ? 'Pivot 카탈로그 다시 불러오기' : 'Pivot 다시 시도'}
          </Button>
        </Notice>
      )}
      {result && (
        <>
          {(result.limits.truncatedRows || result.limits.truncatedColumns) && (
            <Notice severity="info">
              전체 {result.limits.totalRowGroups}행 그룹 · {result.limits.totalColumnGroups}열 그룹 중 상위{' '}
              {result.rows.length}행 · {result.columns.length}열만 표시합니다. 합계에는 숨겨진 그룹도 포함됩니다. 필터로
              범위를 줄이세요.
            </Notice>
          )}
          <div
            role="region"
            aria-label="Pivot 표 가로 스크롤"
            tabIndex={0}
            className="mt-1 max-h-[600px] max-w-full overflow-auto rounded-xl border text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f46e5]"
          >
            <Table className="min-w-full border-separate border-spacing-0 text-[13px]">
              <TableCaption className="mt-0 p-2 text-left text-xs text-inherit">
                현재 기간 Pivot · {rowDimensions.join(' / ')}
                {column ? ` × ${column}` : ''} · 합계는 전체 필터 결과 기준
              </TableCaption>
              <TableHeader className="sticky top-0 z-10 [&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead
                    scope="col"
                    rowSpan={2}
                    className="sticky left-0 z-[1] h-auto border-b bg-[#f8fafc] px-2 py-1 text-left font-semibold whitespace-normal md:py-0.5"
                  >
                    {rowDimensions.join(' / ')}
                  </TableHead>
                  {result.columns.map(col => (
                    <TableHead
                      key={col.key}
                      scope="colgroup"
                      colSpan={result.metrics.length}
                      className="h-auto border-b bg-[#f8fafc] px-2 py-1 font-semibold whitespace-normal md:py-0.5"
                    >
                      {column ? (
                        <Button
                          variant="ghost"
                          aria-label={`Pivot 열 필터 ${col.values.map(category).join(' / ')}`}
                          className="min-h-8 min-w-0 justify-start px-1.5 text-sm whitespace-nowrap"
                          onClick={() => applyAxis([column], col.values)}
                        >
                          {col.values.map(category).join(' / ')}
                        </Button>
                      ) : (
                        '지표'
                      )}
                    </TableHead>
                  ))}
                  {column && (
                    <TableHead
                      scope="colgroup"
                      colSpan={result.metrics.length}
                      className="h-auto border-b bg-[#f8fafc] px-2 py-1.5 text-right font-semibold whitespace-normal"
                    >
                      행 전체 합계
                    </TableHead>
                  )}
                </TableRow>
                <TableRow className="border-0 hover:bg-transparent">
                  {[...result.columns, ...(column ? [{ key: 'totals' }] : [])].flatMap(col =>
                    result.metrics.map(metric => (
                      <TableHead
                        key={`${col.key}-${metric.id}`}
                        scope="col"
                        className="h-auto border-b bg-[#f8fafc] px-2 py-1.5 text-right font-semibold whitespace-nowrap"
                      >
                        {metric.label}
                      </TableHead>
                    )),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  data-pivot-total
                  className="border-0 hover:bg-transparent [&>td]:bg-[#f8fafc] [&>td]:font-semibold"
                >
                  <TableHead
                    scope="row"
                    className="sticky left-0 z-[1] h-auto border-b bg-[#f8fafc] px-2 py-1 text-left font-semibold whitespace-normal md:py-0.5"
                  >
                    전체 합계
                  </TableHead>
                  {result.columns.flatMap(col =>
                    result.metrics.map((metric, i) => valueCell(col.totals[i], metric, `${col.key}-${metric.id}`)),
                  )}
                  {column &&
                    result.metrics.map((metric, i) => valueCell(result.grandTotals[i], metric, `grand-${metric.id}`))}
                </TableRow>
                {result.rows.map(row => (
                  <TableRow key={row.key} className="border-0 hover:bg-[#f5f7ff]">
                    <TableHead
                      scope="row"
                      className="sticky left-0 z-[1] h-auto border-b bg-[#f8fafc] px-2 py-1 text-left font-semibold whitespace-normal md:py-0.5"
                    >
                      <Button
                        variant="ghost"
                        aria-label={`Pivot 행 필터 ${row.values.map(category).join(' / ')}`}
                        className="min-h-8 min-w-0 justify-start px-1.5 text-sm whitespace-nowrap"
                        onClick={() => applyAxis(rowDimensions, row.values)}
                      >
                        {row.values.map(category).join(' / ')}
                      </Button>
                    </TableHead>
                    {result.columns.flatMap(col => {
                      const cell = row.cells.find(c => c.columnKey === col.key);
                      return result.metrics.map((metric, i) =>
                        valueCell(cell?.values[i], metric, `${col.key}-${metric.id}`, !cell),
                      );
                    })}
                    {column && result.metrics.map((metric, i) => valueCell(row.totals[i], metric, `total-${metric.id}`))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {result.rows.length === 0 && (
            <Notice severity="info">이 조건에 해당하는 원본 행이 없습니다. 필터나 기간을 변경하세요.</Notice>
          )}
        </>
      )}
    </section>
  );
}
