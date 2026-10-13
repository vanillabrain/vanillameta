import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, Stack, TextField, Typography, useTheme } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { get, post } from '@/helpers/apiHelper';
import NumericBoard from '@/widget/modules/board/NumericBoard';
import { analysisOptions } from '@/pages/Dashboard/analysisOptions';
import FileVersions from './FileVersions';

const ChartPreview = React.lazy(() => import('echarts-for-react'));

type Source = { id: number; name: string; engine: string };
type Column = {
  name: string;
  type: string;
  numeric: boolean;
  temporal: boolean;
  nullCount: string;
  min?: string | null;
  max?: string | null;
};
type Profile = {
  sourceId: number;
  name: string;
  engine: string;
  status: string;
  dataVersion: string;
  supported: boolean;
  storedAt?: string;
  rowCount: string;
  columns?: Column[];
  preview?: Record<string, unknown>[];
};
type Aggregation = 'SUM' | 'COUNT' | 'COUNT_DISTINCT' | 'AVG' | 'MIN' | 'MAX' | 'WEIGHTED_AVG' | 'RATIO_SUM';
type Definition = {
  schemaVersion?: 1;
  sourceId: number;
  label: string;
  aggregation: Aggregation;
  column: string;
  weightColumn?: string;
  denominatorColumn?: string;
  scale?: 1 | 100;
  unit: string;
  decimalPlaces: number;
  numberNotation: 'plain' | 'compact';
};
type Metric = { id: number; label: string; definitionVersion: number; definition: Definition };
type Preview = {
  rows: { value: unknown; dimension?: unknown }[];
  metric: Definition;
  sourceRevision: string;
  definitionVersion: number;
  sqlGenerated: boolean;
  limit: number;
  complete: boolean;
};
type Chart = 'number' | 'bar' | 'line';
const emptyDefinition: Definition = {
  sourceId: 0,
  label: '',
  aggregation: 'SUM',
  column: '',
  unit: '',
  decimalPlaces: 0,
  numberNotation: 'plain',
};
const text = (value: unknown) => (value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value));
const unwrap = <T,>(response: { data: { status: string; data: T } }): T => {
  if (response.data.status !== 'SUCCESS' || response.data.data == null) throw new Error('Invalid response');
  return response.data.data;
};

function Select({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
    >
      {children}
    </TextField>
  );
}

export default function Explore() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const useAiLabel = t('fileAnalysis.buildWithAi');
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState(() =>
    /^\d+$/.test(searchParams.get('sourceId') || '') ? searchParams.get('sourceId') || '' : '',
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricId, setMetricId] = useState('');
  const [definition, setDefinition] = useState<Definition>(emptyDefinition);
  const [chart, setChart] = useState<Chart>('number');
  const [dimension, setDimension] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const invalidate = () => {
    revision.current += 1;
    controller.current?.abort();
    pending.current = false;
    setBusy('');
    setPreview(null);
    setError('');
  };

  useEffect(() => {
    revision.current += 1;
    const token = revision.current;
    const abort = new AbortController();
    controller.current = abort;
    pending.current = true;
    setBusy('데이터 불러오는 중…');
    setError('');
    setProfile(null);
    setMetrics([]);
    setPreview(null);
    const load = async () => {
      try {
        if (!sourceId) {
          const list = unwrap<Source[]>(await get('/bi/sources', undefined, { signal: abort.signal }));
          if (revision.current === token) setSources(list);
        } else {
          const [nextProfile, saved, sourceList] = await Promise.all([
            get(`/bi/sources/${encodeURIComponent(sourceId)}/profile`, undefined, { signal: abort.signal }).then(
              unwrap<Profile>,
            ),
            get('/bi/metrics', { sourceId: Number(sourceId) }, { signal: abort.signal }).then(unwrap<Metric[]>),
            get('/bi/sources', undefined, { signal: abort.signal }).then(unwrap<Source[]>),
          ]);
          if (revision.current === token) {
            setSources(sourceList);
            setProfile(nextProfile);
            setMetrics(saved);
          }
        }
      } catch {
        if (revision.current === token) setError('데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
      } finally {
        if (revision.current === token) {
          pending.current = false;
          setBusy('');
        }
      }
    };
    void load();
    return () => {
      revision.current += 1;
      abort.abort();
      pending.current = false;
    };
  }, [sourceId, reload]);

  const columns = profile?.columns ?? [];
  const ready = profile?.supported && profile.status === 'ready';
  const weighted = definition.aggregation === 'WEIGHTED_AVG';
  const ratio = definition.aggregation === 'RATIO_SUM';
  const numericColumns = columns.filter(column => column.numeric);
  const eligibleColumns = columns.filter(
    column => !['SUM', 'AVG', 'MIN', 'MAX', 'WEIGHTED_AVG', 'RATIO_SUM'].includes(definition.aggregation) || column.numeric,
  );
  const dimensions = columns.filter(column =>
    chart === 'line' ? column.temporal && /^(DATE|TIMESTAMP)/i.test(column.type) : !column.numeric && !column.temporal,
  );
  const validMetric =
    !!definition.label.trim() &&
    (definition.aggregation === 'COUNT' || eligibleColumns.some(column => column.name === definition.column)) &&
    (!weighted || numericColumns.some(column => column.name === definition.weightColumn)) &&
    (!ratio ||
      (numericColumns.some(column => column.name === definition.denominatorColumn) &&
        [1, 100].includes(definition.scale ?? 1)));
  const validChart = !!title.trim() && (chart === 'number' || dimensions.some(column => column.name === dimension));
  const changeDefinition = (patch: Partial<Definition>) => {
    invalidate();
    setMetricId('');
    setDefinition(current => ({ ...current, ...patch }));
  };
  const body = {
    sourceId: Number(sourceId),
    metricId: Number(metricId),
    chart,
    title: title.trim(),
    ...(chart === 'number' ? {} : { dimension }),
  };
  const run = async (action: 'metric' | 'preview' | 'dashboard') => {
    if (pending.current) return;
    pending.current = true;
    const token = revision.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(action === 'metric' ? '지표 저장 중…' : action === 'preview' ? '결과 확인 중…' : '대시보드 저장 중…');
    setError('');
    try {
      if (action === 'metric') {
        const saved = unwrap<Metric>(
          await post(
            '/bi/metrics',
            {
              ...definition,
              sourceId: Number(sourceId),
              label: definition.label.trim(),
              column: definition.aggregation === 'COUNT' ? '*' : definition.column,
            },
            { signal: abort.signal },
          ),
        );
        if (token !== revision.current) return;
        setMetrics(current => [...current.filter(metric => metric.id !== saved.id), saved]);
        setMetricId(String(saved.id));
        setDefinition(saved.definition);
        setPreview(null);
      } else if (action === 'preview') {
        setPreview(null);
        const result = unwrap<Preview>(await post('/bi/preview', body, { signal: abort.signal }));
        if (token === revision.current) setPreview(result);
      } else {
        const saved = unwrap<{ id: number; revision: string }>(await post('/bi/dashboards', body, { signal: abort.signal }));
        if (token === revision.current) navigate(`/dashboard/${saved.id}`);
      }
    } catch (e: unknown) {
      const serverMessage = (e as { response?: { data?: { data?: unknown } } })?.response?.data?.data;
      if (token === revision.current)
        setError(
          action === 'metric'
            ? typeof serverMessage === 'string'
              ? serverMessage
              : '지표를 저장하지 못했습니다. 아래 지표 저장 버튼으로 다시 시도해 주세요.'
            : action === 'preview'
            ? '결과를 확인하지 못했습니다. 아래 결과 미리보기 버튼으로 다시 시도해 주세요.'
            : '대시보드를 저장하지 못했습니다. 아래 대시보드 저장 버튼으로 다시 시도해 주세요.',
        );
    } finally {
      if (token === revision.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        pb: { xs: 10, md: 4 },
        maxWidth: 1200,
        width: '100%',
        mx: 'auto',
        minWidth: 0,
        '& .MuiButton-root': { minHeight: 44 },
        '& .MuiInputBase-root': { minHeight: 44 },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h1" variant="h4">
          SQL 없이 차트 만들기
        </Typography>
        <Button onClick={() => navigate(`/explore/source${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`)}>
          지표 탐색
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        저장된 파일의 열을 선택해 지표와 차트를 만들고 대시보드에 저장하세요.
      </Typography>
      {ready && profile.engine === 'duckdb' && !busy && (
        <Button variant="outlined" sx={{ mb: 2 }} onClick={() => navigate(`/dashboard?aiSourceId=${profile.sourceId}`)}>
          {useAiLabel}
        </Button>
      )}
      <Typography role="status" aria-live="polite" sx={{ mb: 1 }}>
        {busy}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
          <Button
            disabled={!!busy}
            onClick={() => {
              invalidate();
              setMetricId('');
              setReload(value => value + 1);
            }}
          >
            데이터 다시 불러오기
          </Button>
        </Alert>
      )}
      <Stack spacing={3}>
        <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
            1. 데이터 확인
          </Typography>
          <Select
            label="데이터 소스"
            value={sourceId}
            disabled={!!busy && busy !== '데이터 불러오는 중…'}
            onChange={value => {
              invalidate();
              setSourceId(value);
              setMetricId('');
              setDefinition({ ...emptyDefinition, sourceId: Number(value) });
              setDimension('');
            }}
          >
            <option value="">데이터를 선택하세요</option>
            {sources.map(source => (
              <option key={source.id} value={source.id}>
                {source.name} ({source.engine})
              </option>
            ))}
          </Select>
          {!sourceId && !busy && !error && sources.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              저장된 데이터가 없습니다. <Button onClick={() => navigate('/data/file')}>파일 저장하러 가기</Button>
            </Alert>
          )}
          {profile && !ready && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              아직 분석할 수 없는 데이터입니다. 현재는 서버에 저장된 DuckDB 파일 데이터만 지원합니다.
            </Alert>
          )}
          {ready && (
            <>
              <Typography sx={{ my: 2 }}>
                저장된 전체 행 수: {profile.rowCount} · 데이터 버전: {profile.dataVersion.slice(0, 12)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {profile.storedAt ? `서버 저장 시각: ${new Date(profile.storedAt).toLocaleString('ko-KR')}. ` : ''}
                날짜 범위는 데이터 기준입니다. 빈 값은 0이 아니며, 합계·평균 등은 빈 값을 제외하고 행 수는 전체 행을 셉니다.
              </Typography>
              <Box
                tabIndex={0}
                role="region"
                aria-label="데이터 프로필과 원본 샘플 표"
                sx={{
                  overflowX: 'auto',
                  minWidth: 0,
                  maxWidth: '100%',
                  '& th, & td': {
                    p: 1,
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                    overflowWrap: 'anywhere',
                  },
                }}
              >
                <table style={{ width: '100%', minWidth: 480 }}>
                  <caption>저장된 데이터 프로필</caption>
                  <thead>
                    <tr>
                      <th scope="col">열</th>
                      <th scope="col">타입</th>
                      <th scope="col">빈 값 수</th>
                      <th scope="col">날짜 범위</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map(column => (
                      <tr key={column.name}>
                        <th scope="row">{column.name}</th>
                        <td>{column.type}</td>
                        <td>{column.nullCount}</td>
                        <td>{column.temporal ? `${column.min ?? '—'} ~ ${column.max ?? '—'}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table style={{ width: '100%', minWidth: 480, marginTop: 16 }}>
                  <caption>원본 샘플 · 처음 최대 5행 (전체 집계 결과가 아닙니다)</caption>
                  <thead>
                    <tr>
                      {columns.map(column => (
                        <th scope="col" key={column.name}>
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.preview ?? []).slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {columns.map(column => (
                          <td key={column.name}>{text(row[column.name])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
              {profile.engine?.toLowerCase() === 'duckdb' && (
                <FileVersions
                  sourceId={profile.sourceId}
                  disabled={!!busy}
                  onChanged={() => {
                    invalidate();
                    setReload(value => value + 1);
                  }}
                />
              )}
            </>
          )}
        </Card>
        {ready && (
          <>
            <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
              <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                2. 지표 저장 또는 재사용
              </Typography>
              <Stack spacing={2}>
                <Select
                  label="저장된 지표"
                  value={metricId}
                  disabled={!!busy}
                  onChange={value => {
                    invalidate();
                    setMetricId(value);
                    const saved = metrics.find(metric => String(metric.id) === value);
                    setDefinition(saved ? saved.definition : { ...emptyDefinition, sourceId: Number(sourceId) });
                  }}
                >
                  <option value="">새 지표 만들기</option>
                  {metrics.map(metric => (
                    <option key={metric.id} value={metric.id}>
                      {metric.label}
                    </option>
                  ))}
                </Select>
                <TextField
                  label="지표 이름"
                  value={definition.label}
                  disabled={!!busy}
                  onChange={event => changeDefinition({ label: event.target.value })}
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Select
                    label="집계 방법"
                    value={definition.aggregation}
                    disabled={!!busy}
                    onChange={value =>
                      changeDefinition({
                        aggregation: value as Aggregation,
                        column: value === 'COUNT' ? '*' : '',
                        weightColumn: undefined,
                        denominatorColumn: undefined,
                        scale: value === 'RATIO_SUM' ? 1 : undefined,
                      })
                    }
                  >
                    <option value="SUM">합계</option>
                    <option value="COUNT">행 수</option>
                    <option value="COUNT_DISTINCT">고유 값 수</option>
                    <option value="AVG">평균</option>
                    <option value="MIN">최솟값</option>
                    <option value="MAX">최댓값</option>
                    <option value="WEIGHTED_AVG">가중 평균</option>
                    <option value="RATIO_SUM">합계 비율</option>
                  </Select>
                  <Select
                    label={weighted ? '값 열' : ratio ? '분자 열' : '집계할 열'}
                    value={definition.aggregation === 'COUNT' ? '*' : definition.column}
                    disabled={!!busy || definition.aggregation === 'COUNT'}
                    onChange={value => changeDefinition({ column: value })}
                  >
                    {definition.aggregation === 'COUNT' ? (
                      <option value="*">전체 행 (*)</option>
                    ) : (
                      <>
                        <option value="">열을 선택하세요</option>
                        {eligibleColumns.map(column => (
                          <option key={column.name} value={column.name}>
                            {column.name}
                          </option>
                        ))}
                      </>
                    )}
                  </Select>
                  {(weighted || ratio) && (
                    <Select
                      label={weighted ? '가중치 열' : '분모 열'}
                      value={(weighted ? definition.weightColumn : definition.denominatorColumn) ?? ''}
                      disabled={!!busy}
                      onChange={value => changeDefinition(weighted ? { weightColumn: value } : { denominatorColumn: value })}
                    >
                      <option value="">숫자 열을 선택하세요</option>
                      {numericColumns.map(column => (
                        <option key={column.name} value={column.name}>
                          {column.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Stack>
                {ratio && (
                  <Select
                    label="결과 배율"
                    value={String(definition.scale ?? 1)}
                    disabled={!!busy}
                    onChange={value => changeDefinition({ scale: Number(value) as 1 | 100 })}
                  >
                    <option value="1">1 (비율)</option>
                    <option value="100">100 (백분율)</option>
                  </Select>
                )}
                {weighted && (
                  <Typography variant="body2" color="text.secondary">
                    계산식: SUM(값 × 가중치) / SUM(가중치). 값과 가중치가 모두 있는 행만 포함하며, 둘 중 하나라도 빈
                    값(NULL)이면 해당 행을 제외합니다. 가중치 합계가 0이거나 음수 가중치가 있으면 해당 그룹의 결과는 값
                    없음(NULL, —)입니다.
                  </Typography>
                )}
                {ratio && (
                  <Typography variant="body2" color="text.secondary">
                    계산식: SUM(분자) / SUM(분모) × {definition.scale ?? 1}. 분자와 분모는 각각 자신의 빈 값(NULL)을 제외하고
                    합산합니다. 분모 합계가 0이거나 어느 한쪽에 값이 없으면 결과는 값 없음(NULL, —)입니다.
                  </Typography>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    label="단위 (선택)"
                    value={definition.unit}
                    disabled={!!busy}
                    onChange={event => changeDefinition({ unit: event.target.value })}
                  />
                  <Select
                    label="소수 자릿수"
                    value={String(definition.decimalPlaces)}
                    disabled={!!busy}
                    onChange={value => changeDefinition({ decimalPlaces: Number(value) })}
                  >
                    {Array.from({ length: 7 }, (_, index) => (
                      <option key={index} value={index}>
                        {index}자리
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="숫자 표시"
                    value={definition.numberNotation}
                    disabled={!!busy}
                    onChange={value => changeDefinition({ numberNotation: value as Definition['numberNotation'] })}
                  >
                    <option value="plain">일반 숫자</option>
                    <option value="compact">축약 숫자</option>
                  </Select>
                </Stack>
                <Button
                  variant="contained"
                  disabled={!!busy || !validMetric || !!metricId}
                  onClick={() => void run('metric')}
                >
                  지표 저장
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {metricId
                    ? '저장된 지표를 사용합니다. 내용을 변경하면 새 지표로 저장할 수 있습니다.'
                    : '먼저 지표를 저장한 뒤 결과를 확인하세요. 합계·평균·최솟값·최댓값·가중 평균·합계 비율은 숫자 열만 선택할 수 있습니다.'}
                </Typography>
              </Stack>
            </Card>
            <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
              <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                3. 차트 결과 확인
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="차트 제목"
                  value={title}
                  disabled={!!busy}
                  onChange={event => {
                    invalidate();
                    setTitle(event.target.value);
                  }}
                />
                <Select
                  label="차트 종류"
                  value={chart}
                  disabled={!!busy}
                  onChange={value => {
                    invalidate();
                    setChart(value as Chart);
                    setDimension('');
                  }}
                >
                  <option value="number">숫자</option>
                  <option value="bar">막대 · 범주별</option>
                  <option value="line">선 · 날짜별</option>
                </Select>
                {chart !== 'number' && (
                  <Select
                    label={chart === 'line' ? '날짜 열' : '범주 열'}
                    value={dimension}
                    disabled={!!busy}
                    onChange={value => {
                      invalidate();
                      setDimension(value);
                    }}
                  >
                    <option value="">열을 선택하세요</option>
                    {dimensions.map(column => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </Select>
                )}
                {chart !== 'number' && dimensions.length === 0 && (
                  <Alert severity="info">
                    이 차트에 사용할 {chart === 'line' ? '날짜' : '범주'} 열이 없습니다. 다른 차트 종류를 선택하세요.
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  disabled={!!busy || !metricId || !validMetric || !validChart}
                  onClick={() => void run('preview')}
                >
                  결과 미리보기
                </Button>
                {preview && (
                  <Box
                    tabIndex={0}
                    role="region"
                    aria-label="집계 결과 표"
                    sx={{
                      overflowX: 'auto',
                      minWidth: 0,
                      maxWidth: '100%',
                      '& th, & td': {
                        p: 1,
                        textAlign: 'left',
                        borderBottom: 1,
                        borderColor: 'divider',
                        overflowWrap: 'anywhere',
                      },
                    }}
                  >
                    <Typography component="h3" variant="h6">
                      {title}
                    </Typography>
                    {chart === 'number' ? (
                      <Box sx={{ height: 155 }}>
                        <NumericBoard
                          dataSet={preview.rows}
                          option={analysisOptions({
                            type: 'BOARD_NUMERIC',
                            valueField: 'value',
                            decimalPlaces: preview.metric.decimalPlaces,
                            numberNotation: preview.metric.numberNotation === 'compact' ? 'compact' : 'full',
                            suffix: preview.metric.unit ? ` ${preview.metric.unit}` : '',
                          })}
                        />
                      </Box>
                    ) : (
                      <React.Suspense fallback={<Typography>차트 불러오는 중…</Typography>}>
                        <ChartPreview
                          style={{ height: 280, width: '100%' }}
                          option={{
                            color: [theme.palette.primary.main],
                            animation: false,
                            grid: { left: 16, right: 16, bottom: 48, top: 24, containLabel: true },
                            tooltip: { trigger: 'axis' },
                            xAxis: {
                              type: 'category',
                              data: preview.rows.map(row => text(row.dimension)),
                              axisLabel: { color: theme.palette.text.secondary, hideOverlap: true },
                            },
                            yAxis: { type: 'value', axisLabel: { color: theme.palette.text.secondary } },
                            series: [
                              {
                                type: chart,
                                name: preview.metric.label,
                                data: preview.rows.map(row => (row.value == null ? null : Number(row.value))),
                              },
                            ],
                          }}
                          opts={{ renderer: 'svg' }}
                        />
                      </React.Suspense>
                    )}
                    <table style={{ width: '100%' }}>
                      <caption>
                        {chart === 'number' ? '실제 집계 결과' : `최대 ${preview.limit ?? 500}개 그룹`}
                        {` · ${preview.rows.length}개 결과 · ${
                          preview.complete ? '전체 결과' : '일부 결과 (전체가 아닐 수 있습니다)'
                        }`}
                      </caption>
                      <thead>
                        <tr>
                          {chart !== 'number' && <th scope="col">{dimension}</th>}
                          <th scope="col">{preview.metric.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, index) => (
                          <tr key={index}>
                            {chart !== 'number' && <td>{text(row.dimension)}</td>}
                            <td>
                              {text(row.value)}
                              {preview.metric.unit ? ` ${preview.metric.unit}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.rows.length === 0 && <Typography>집계 결과가 없습니다.</Typography>}
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      데이터 버전: {preview.sourceRevision.slice(0, 12)} · 지표 버전: {preview.definitionVersion}
                    </Typography>
                  </Box>
                )}
                <Button
                  variant="contained"
                  disabled={!!busy || !preview || !metricId || !validMetric || !validChart}
                  onClick={() => void run('dashboard')}
                >
                  대시보드 저장
                </Button>
              </Stack>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  );
}
