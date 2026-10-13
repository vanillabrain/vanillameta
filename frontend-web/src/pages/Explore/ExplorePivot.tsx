import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';
import type { ExploreViewState } from './ExploreSavedViews';

export type PivotValue = {
  measureId: number;
  value: number | string | null;
  comparison?: { previousValue?: unknown; delta?: unknown; percentChange?: unknown; unavailable?: string };
};
export type PivotResult = {
  sourceRevision: string;
  rowColumns: string[];
  columnColumns: string[];
  rows: unknown[][];
  columns: unknown[][];
  cells: Array<{ row: number; column: number; measures: PivotValue[] }>;
  rowTotals: PivotValue[][];
  columnTotals: PivotValue[][];
  grandTotal: PivotValue[];
};
export type PivotAxes = { rowColumns: string[]; columnColumns: string[] };
const category = (value: unknown): string => (value == null ? '(값 없음)' : value === '' ? '(빈 문자열)' : String(value));
const tuple = (values: unknown[]) => (values.length ? values.map(category).join(' / ') : '전체');
const errorText = (error: unknown) => {
  const e = error as { response?: { status?: number; data?: { data?: unknown; message?: unknown } } };
  if (e.response?.status === 409) return '데이터 버전이 변경되었습니다. 카탈로그를 다시 불러와 주세요.';
  const body = e.response?.data;
  const detail = body?.data;
  const reason =
    typeof detail === 'string'
      ? detail
      : detail && typeof detail === 'object' && 'message' in detail
      ? detail.message
      : body?.message;
  return typeof reason === 'string' ? reason : 'Pivot을 불러오지 못했습니다. 다시 시도해 주세요.';
};

/** Bounded server aggregates, including separately aggregated non-additive totals. */
export default function ExplorePivot({
  sourceId,
  sourceRevision,
  measures,
  dimensions,
  state,
  axes,
  onAxesChange,
  onReady,
  blocked,
  formatValue,
  formatComparison,
  onFilter,
  onReloadCatalog,
  onMeasureToggle,
}: {
  sourceId: number;
  sourceRevision: string;
  measures: Array<{ id: number; label: string }>;
  dimensions: Array<{ column: string }>;
  state: ExploreViewState;
  axes: PivotAxes;
  onAxesChange: (axes: PivotAxes) => void;
  onReady: (ready: boolean) => void;
  blocked: boolean;
  formatValue: (value: PivotValue) => string;
  formatComparison: (value: PivotValue) => string;
  onFilter: (column: string, values: Array<string | number | boolean | null>) => void;
  onReloadCatalog: () => void;
  onMeasureToggle: (id: number) => void;
}) {
  const [result, setResult] = useState<PivotResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const sequence = useRef(0);
  const payload = useMemo(
    () => ({
      sourceId,
      sourceRevision,
      measureIds: state.measureIds,
      rowColumns: axes.rowColumns,
      columnColumns: axes.columnColumns,
      filters: state.filters,
      ...(state.dateRange ? { dateRange: state.dateRange } : {}),
      comparePrevious: state.comparePrevious,
    }),
    [
      sourceId,
      sourceRevision,
      state.measureIds,
      axes.rowColumns,
      axes.columnColumns,
      state.filters,
      state.dateRange,
      state.comparePrevious,
    ],
  );
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    setResult(null);
    setError('');
    onReady(false);
    if (blocked || !payload.measureIds.length) {
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    post('/bi/explore/pivot', payload, { signal: abort.signal })
      .then(response => {
        if (token !== sequence.current) return;
        if (response?.data?.status !== 'SUCCESS') throw new Error('invalid pivot response');
        const data: PivotResult = response.data.data;
        if (data.sourceRevision !== sourceRevision)
          throw Object.assign(new Error('source revision changed'), { response: { status: 409 } });
        setResult(data);
        onReady(true);
      })
      .catch(err => {
        if (token === sequence.current && !abort.signal.aborted) setError(errorText(err));
      })
      .finally(() => {
        if (token === sequence.current) setBusy(false);
      });
    return () => {
      sequence.current += 1;
      abort.abort();
    };
  }, [payload, sourceRevision, blocked, reload, onReady]);

  const changeAxis = (axis: keyof PivotAxes, index: number, column: string) => {
    const next = axes[axis].filter((_, i) => i !== index);
    if (column) next.splice(index, 0, column);
    onAxesChange({ ...axes, [axis]: next });
  };
  const selectedMeasures = state.measureIds
    .map(id => measures.find(measure => measure.id === id))
    .filter((m): m is { id: number; label: string } => !!m);
  const cells = useMemo(
    () => new Map(result?.cells.map(cell => [`${cell.row}:${cell.column}`, cell.measures]) ?? []),
    [result],
  );
  const renderValue = (values: PivotValue[] | undefined, measureId: number) => {
    const value = values?.find(item => item.measureId === measureId) ?? { measureId, value: null };
    return (
      <>
        <div>{formatValue(value)}</div>
        {state.comparePrevious && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{formatComparison(value)}</div>
        )}
      </>
    );
  };
  const hasColumnSplits = axes.columnColumns.length > 0;
  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #f1f5f9',
    textAlign: 'right',
    minWidth: 145,
    whiteSpace: 'nowrap',
  };
  const headerStyle: React.CSSProperties = {
    ...cellStyle,
    background: '#f8fafc',
    fontWeight: 600,
  };
  return (
    <Box sx={{ mt: 2, minWidth: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
      <Box
        sx={{
          flex: { md: '0 0 210px' },
          border: '1px solid #e2e8f0',
          borderRadius: 2,
          p: 1.5,
          maxHeight: 700,
          overflowY: 'auto',
        }}
      >
        <TextField
          label="Pivot 필드 검색"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: '100%', mb: 1 }}
        />
        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1 }}>지표 · 열에 표시</Typography>
        {measures
          .filter(m => m.label.toLowerCase().includes(search.toLowerCase()))
          .map(m => (
            <Button
              key={m.id}
              aria-pressed={state.measureIds.includes(m.id)}
              onClick={() => onMeasureToggle(m.id)}
              sx={{
                display: 'block',
                textAlign: 'left',
                textTransform: 'none',
                color: state.measureIds.includes(m.id) ? '#4f46e5' : '#64748b',
              }}
            >
              {state.measureIds.includes(m.id) ? '✓ ' : '+ '}
              {m.label}
            </Button>
          ))}
        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 2 }}>차원</Typography>
        {dimensions
          .filter(d => d.column.toLowerCase().includes(search.toLowerCase()))
          .map(d => (
            <Box key={d.column} sx={{ py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
              <Typography sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>{d.column}</Typography>
              <Button
                size="small"
                aria-label={`${d.column} 행에 추가`}
                disabled={axes.rowColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => onAxesChange({ ...axes, rowColumns: [...axes.rowColumns, d.column] })}
              >
                + 행
              </Button>
              <Button
                size="small"
                aria-label={`${d.column} 열에 추가`}
                disabled={axes.columnColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => onAxesChange({ ...axes, columnColumns: [...axes.columnColumns, d.column] })}
              >
                + 열
              </Button>
            </Box>
          ))}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ flexWrap: 'wrap', rowGap: 1, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, background: '#f8fafc' }}
        >
          {(['rowColumns', 'columnColumns'] as const).map(axis => (
            <Stack key={axis} direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{axis === 'rowColumns' ? '행' : '열'}</Typography>
              {[0, 1].map(index => (
                <TextField
                  key={index}
                  select
                  size="small"
                  label={`${axis === 'rowColumns' ? '행' : '열'} 차원 ${index + 1}`}
                  value={axes[axis][index] ?? ''}
                  disabled={index > axes[axis].length}
                  onChange={event => changeAxis(axis, index, event.target.value)}
                  sx={{ minWidth: 150 }}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="">{index ? '추가하지 않음' : '전체'}</option>
                  {dimensions
                    .filter(
                      d => ![...axes.rowColumns, ...axes.columnColumns].includes(d.column) || axes[axis][index] === d.column,
                    )
                    .map(d => (
                      <option key={d.column} value={d.column}>
                        {d.column}
                      </option>
                    ))}
                </TextField>
              ))}
            </Stack>
          ))}
          <Button onClick={() => onAxesChange({ rowColumns: axes.columnColumns, columnColumns: axes.rowColumns })}>
            행·열 바꾸기
          </Button>
          <Button onClick={() => onAxesChange({ rowColumns: [], columnColumns: [] })}>구성 초기화</Button>
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          지표 {selectedMeasures.map(m => m.label).join(' · ')} · 최대 50행 / 20열 그룹 / 6,000개 값 · 합계는 원본에서 다시
          집계
        </Typography>
        {blocked && <Alert severity="info">유효한 기간과 지표를 선택하세요.</Alert>}
        {busy && (
          <Typography role="status" sx={{ mt: 2 }}>
            Pivot을 불러오는 중…
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
            <Button onClick={() => setReload(v => v + 1)}>다시 시도</Button>
            <Button onClick={onReloadCatalog}>카탈로그 다시 불러오기</Button>
          </Alert>
        )}
        {result && (
          <Box
            role="region"
            aria-label="Pivot 결과"
            tabIndex={0}
            sx={{ mt: 1.5, overflow: 'auto', maxHeight: 620, border: '1px solid #e2e8f0', borderRadius: 2 }}
          >
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 13 }}>
              <caption style={{ textAlign: 'left', padding: 12 }}>
                Pivot · {result.rows.length}행 × {result.columns.length}열 그룹 · 필터 {state.filters.length}개
                {state.comparePrevious ? ' · 이전 기간 비교' : ''}
              </caption>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th rowSpan={2} style={{ ...headerStyle, textAlign: 'left' }}>
                    {axes.rowColumns.join(' / ') || '전체'}
                  </th>
                  {hasColumnSplits && (
                    <th colSpan={selectedMeasures.length} style={headerStyle}>
                      합계
                    </th>
                  )}
                  {result.columns.map((values, i) => (
                    <th key={i} colSpan={selectedMeasures.length} style={headerStyle}>
                      {tuple(values)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {[...Array(result.columns.length + (hasColumnSplits ? 1 : 0))].map((_, column) =>
                    selectedMeasures.map(m => (
                      <th key={`${column}:${m.id}`} style={headerStyle}>
                        {m.label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" style={{ ...cellStyle, textAlign: 'left', background: '#eef2ff' }}>
                    총합
                  </th>
                  {hasColumnSplits &&
                    selectedMeasures.map(m => (
                      <td key={m.id} style={{ ...cellStyle, fontWeight: 700, background: '#eef2ff' }}>
                        {renderValue(result.grandTotal, m.id)}
                      </td>
                    ))}
                  {result.columns.map((_, c) =>
                    selectedMeasures.map(m => (
                      <td key={`${c}:${m.id}`} style={{ ...cellStyle, background: '#eef2ff' }}>
                        {renderValue(result.columnTotals[c], m.id)}
                      </td>
                    )),
                  )}
                </tr>
                {axes.rowColumns.length > 0 &&
                  result.rows.map((values, r) => (
                    <tr key={r}>
                      <th
                        scope="row"
                        style={{
                          ...cellStyle,
                          textAlign: 'left',
                          position: 'sticky',
                          left: 0,
                          background: '#fff',
                          zIndex: 1,
                        }}
                      >
                        {values.length
                          ? values.map((value, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && ' / '}
                                <button
                                  type="button"
                                  title={`${axes.rowColumns[i]} 필터 적용`}
                                  onClick={() => onFilter(axes.rowColumns[i], [value as string | number | boolean | null])}
                                  style={{ border: 0, background: 'none', color: '#334155', padding: 2, cursor: 'pointer' }}
                                >
                                  {category(value)}
                                </button>
                              </React.Fragment>
                            ))
                          : '전체'}
                      </th>
                      {hasColumnSplits &&
                        selectedMeasures.map(m => (
                          <td key={m.id} style={{ ...cellStyle, fontWeight: 600 }}>
                            {renderValue(result.rowTotals[r], m.id)}
                          </td>
                        ))}
                      {result.columns.map((_, c) =>
                        selectedMeasures.map(m => (
                          <td key={`${c}:${m.id}`} style={cellStyle}>
                            {renderValue(cells.get(`${r}:${c}`), m.id)}
                          </td>
                        )),
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
            {!result.rows.length && <Typography sx={{ p: 2 }}>조건에 맞는 데이터가 없습니다.</Typography>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
