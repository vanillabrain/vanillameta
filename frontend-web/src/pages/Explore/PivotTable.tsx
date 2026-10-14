import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';
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
  sourceId: number;
  sourceRevision: string;
  dimensions: { column: string; temporal?: boolean }[];
  measureIds: number[];
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  paused: boolean;
  pauseReason?: string;
  fixedAxes?: boolean;
  embedded?: boolean;
  axes?: PivotAxes;
  onAxesChange?: (axes: PivotAxes) => void;
  onReady?: (status: { key: string; reason: string }) => void;
  onFilter: (filters: ExploreFilter[]) => void;
  onReloadCatalog: () => void;
};
const category = (v: unknown) => (v === null ? '(NULL)' : v === '' ? '(빈 문자열)' : String(v));
const errorMessage = (err: any) => {
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
  const rowDimensions = [row1, row2].filter(Boolean);
  const invalid =
    !row1 || new Set([...rowDimensions, column].filter(Boolean)).size !== rowDimensions.length + Number(!!column);
  const paused = props.paused || !props.measureIds.length || invalid;
  const requestKey = pivotRequestKey({
    sourceId: props.sourceId,
    sourceRevision: props.sourceRevision,
    measureIds: props.measureIds,
    rowDimensions,
    columnDimensions: column ? [column] : [],
    filters: props.filters,
    dateRange: props.dateRange,
  });
  const current = !!result && resultKey === requestKey && !paused && !busy && !error;
  useEffect(() => {
    props.onReady?.({ key: requestKey, reason: current ? '' : error || '현재 Pivot 조건을 조회한 뒤 저장해 주세요.' });
  }, [props.onReady, requestKey, current, error]);
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
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
    void post(
      '/bi/explore/pivot',
      {
        sourceId: props.sourceId,
        sourceRevision: props.sourceRevision,
        measureIds: props.measureIds,
        rowDimensions: [row1, row2].filter(Boolean),
        columnDimensions: column ? [column] : [],
        filters: props.filters,
        ...(props.dateRange ? { dateRange: props.dateRange } : {}),
      },
      { signal: abort.signal },
    )
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
    return () => {
      generation.current += 1;
      abort.abort();
    };
  }, [
    props.sourceId,
    props.sourceRevision,
    props.measureIds,
    props.filters,
    props.dateRange,
    paused,
    row1,
    row2,
    column,
    reload,
  ]);
  const downloadCsv = () => {
    if (!current) return;
    try {
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
  const selectProps = { select: { native: true }, inputLabel: { shrink: true } };
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
      <td
        key={key}
        title={missing ? '원본에 이 조합의 행이 없습니다.' : formatted.exactText}
        aria-label={missing ? '조합 없음' : formatted.exactText}
        style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
      >
        {missing ? '조합 없음' : formatted.text}
      </td>
    );
  };
  return (
    <Box component="section" aria-label="Pivot 탐색" sx={{ mt: 2, minWidth: 0 }}>
      {!props.embedded && (
        <Typography component="h2" variant="h6">
          Pivot
        </Typography>
      )}
      <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
        행·열 차원별 교차 분석 · 현재 기간과 공통 필터 적용
      </Typography>
      {props.embedded ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          행 {rowDimensions.join(' / ')} {column ? `× 열 ${column}` : '· 지표만 표시'}
        </Typography>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1, alignItems: { md: 'center' } }}>
          <TextField
            disabled={props.fixedAxes}
            select
            label="Pivot 행 차원"
            size="small"
            value={row1}
            onChange={e => changeAxes(e.target.value, row2, column)}
            slotProps={selectProps}
            sx={{ minWidth: 0, width: { xs: '100%', md: 220 } }}
          >
            {options([row2, column])}
          </TextField>
          <TextField
            disabled={props.fixedAxes}
            select
            label="Pivot 두 번째 행 차원"
            size="small"
            value={row2}
            onChange={e => changeAxes(row1, e.target.value, column)}
            slotProps={selectProps}
            sx={{ minWidth: 0, width: { xs: '100%', md: 220 } }}
          >
            <option value="">추가 차원 없음</option>
            {options([row1, column])}
          </TextField>
          <TextField
            disabled={props.fixedAxes}
            select
            label="Pivot 열 차원"
            size="small"
            value={column}
            onChange={e => changeAxes(row1, row2, e.target.value)}
            slotProps={selectProps}
            sx={{ minWidth: 0, width: { xs: '100%', md: 220 } }}
          >
            <option value="">지표만 표시</option>
            {options([row1, row2])}
          </TextField>
          <Button
            disabled={props.fixedAxes || !column || !!row2}
            onClick={() => {
              changeAxes(column, '', row1);
            }}
          >
            행·열 바꾸기
          </Button>
        </Stack>
      )}
      <Button variant="outlined" disabled={!current} onClick={downloadCsv}>
        Pivot CSV 내보내기
      </Button>
      <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
        표시된 그룹과 전체 합계를 정확한 숫자로 내보냅니다. 제한된 그룹은 CSV의 export_scope에 명시합니다.
      </Typography>
      <Typography role="status" aria-live="polite">
        {exportNotice}
      </Typography>
      <Box component="details" sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
        <summary>정렬·합계·표시 범위 안내</summary>첫 지표의 전체 값 내림차순 · 최대 50행 × 12열 그룹. 전체 합계는 원본에서
        다시 계산합니다. 행·열 이름으로 해당 값을 필터링할 수 있습니다. 비교 기간·시간 집계 축은 아직 지원하지 않습니다.
      </Box>
      <Typography role="status" aria-live="polite" sx={{ minHeight: { xs: 32, md: 24 }, mt: 1 }}>
        {busy
          ? 'Pivot 집계 중…'
          : paused
          ? props.pauseReason || '완성한 기간과 지표·행 차원을 선택하세요.'
          : result
          ? `Pivot ${result.rows.length}행 · ${result.columns.length}열 그룹 적용됨`
          : ''}
      </Typography>
      {error && (
        <Alert severity="error">
          {error}
          <Button onClick={conflict ? props.onReloadCatalog : () => setReload(v => v + 1)}>
            {conflict ? 'Pivot 카탈로그 다시 불러오기' : 'Pivot 다시 시도'}
          </Button>
        </Alert>
      )}
      {result && (
        <>
          {(result.limits.truncatedRows || result.limits.truncatedColumns) && (
            <Alert severity="info">
              전체 {result.limits.totalRowGroups}행 그룹 · {result.limits.totalColumnGroups}열 그룹 중 상위{' '}
              {result.rows.length}행 · {result.columns.length}열만 표시합니다. 합계에는 숨겨진 그룹도 포함됩니다. 필터로
              범위를 줄이세요.
            </Alert>
          )}
          <Box
            role="region"
            aria-label="Pivot 표 가로 스크롤"
            tabIndex={0}
            sx={{
              overflow: 'auto',
              maxHeight: 600,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              mt: 1,
              maxWidth: '100%',
              '&:focus-visible': { outline: '2px solid #4f46e5', outlineOffset: 2 },
              '& table': { borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', fontSize: 13 },
              '& th, & td': { px: 1, py: { xs: 0.5, md: 0.25 }, borderBottom: '1px solid #e2e8f0' },
              '& th': { bgcolor: '#f8fafc', fontWeight: 600 },
              '& thead': { position: 'sticky', top: 0, zIndex: 1 },
              '& tbody tr:hover': { bgcolor: '#f5f7ff' },
              '& th:first-of-type[scope="row"], & th[scope="col"][rowspan]': {
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: '#f8fafc',
              },
              '& button': {
                height: '24px !important',
                minHeight: '24px !important',
                minWidth: 0,
                py: 0,
                px: 0.5,
                fontSize: 13,
              },
              '@media (max-width: 899px)': { '& button': { height: '32px !important', minHeight: '32px !important' } },
              '& [data-pivot-total] td': { bgcolor: '#f8fafc', fontWeight: 600 },
            }}
          >
            <table>
              <caption style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>
                현재 기간 Pivot · {rowDimensions.join(' / ')}
                {column ? ` × ${column}` : ''} · 합계는 전체 필터 결과 기준
              </caption>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>
                    {rowDimensions.join(' / ')}
                  </th>
                  {result.columns.map(col => (
                    <th key={col.key} scope="colgroup" colSpan={result.metrics.length}>
                      {column ? (
                        <Button
                          aria-label={`Pivot 열 필터 ${col.values.map(category).join(' / ')}`}
                          onClick={() => applyAxis([column], col.values)}
                          sx={{
                            textTransform: 'none',
                            whiteSpace: 'nowrap',
                            height: { xs: 32, md: 24 },
                            minHeight: { xs: 32, md: 24 },
                            p: 0,
                          }}
                        >
                          {col.values.map(category).join(' / ')}
                        </Button>
                      ) : (
                        '지표'
                      )}
                    </th>
                  ))}
                  {column && (
                    <th scope="colgroup" colSpan={result.metrics.length}>
                      행 전체 합계
                    </th>
                  )}
                </tr>
                <tr>
                  {[...result.columns, ...(column ? [{ key: 'totals' }] : [])].flatMap(col =>
                    result.metrics.map(metric => (
                      <th key={`${col.key}-${metric.id}`} scope="col" style={{ whiteSpace: 'nowrap' }}>
                        {metric.label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr data-pivot-total>
                  <th scope="row">전체 합계</th>
                  {result.columns.flatMap(col =>
                    result.metrics.map((metric, i) => valueCell(col.totals[i], metric, `${col.key}-${metric.id}`)),
                  )}
                  {column &&
                    result.metrics.map((metric, i) => valueCell(result.grandTotals[i], metric, `grand-${metric.id}`))}
                </tr>
                {result.rows.map(row => (
                  <tr key={row.key}>
                    <th scope="row">
                      <Button
                        aria-label={`Pivot 행 필터 ${row.values.map(category).join(' / ')}`}
                        onClick={() => applyAxis(rowDimensions, row.values)}
                        sx={{
                          textTransform: 'none',
                          whiteSpace: 'nowrap',
                          height: { xs: 32, md: 24 },
                          minHeight: { xs: 32, md: 24 },
                          p: 0,
                        }}
                      >
                        {row.values.map(category).join(' / ')}
                      </Button>
                    </th>
                    {result.columns.flatMap(col => {
                      const cell = row.cells.find(c => c.columnKey === col.key);
                      return result.metrics.map((metric, i) =>
                        valueCell(cell?.values[i], metric, `${col.key}-${metric.id}`, !cell),
                      );
                    })}
                    {column && result.metrics.map((metric, i) => valueCell(row.totals[i], metric, `total-${metric.id}`))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          {result.rows.length === 0 && (
            <Alert severity="info">이 조건에 해당하는 원본 행이 없습니다. 필터나 기간을 변경하세요.</Alert>
          )}
        </>
      )}
    </Box>
  );
}
