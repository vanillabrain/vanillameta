import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';
import {
  BusinessBasis,
  BusinessBasisResult,
  fetchBusinessBasis,
  businessColumnLabel,
  assertOptionalBusinessBasis,
} from '@/api/businessBasis';
import BusinessBasisDetails from './BusinessBasisDetails';
import { chartColors, chartTheme } from '@/components/charts/chartTheme';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField } from '@/components/ui/text-field';
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
  access?: { read: boolean; edit: boolean; publish: boolean; export: boolean };
  owned?: boolean;
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
  businessBasis?: BusinessBasis | null;
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
      label={label}
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="min-w-0"
    >
      {children}
    </TextField>
  );
}

export default function Explore() {
  const session = useRef(editorDraftSessionEpoch());
  const currentSession = () => editorDraftSessionEpoch() === session.current;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const useAiLabel = t('fileAnalysis.buildWithAi');
  const [searchParams] = useSearchParams();
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState(() =>
    /^\d+$/.test(searchParams.get('sourceId') || '') ? searchParams.get('sourceId') || '' : '',
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [basis, setBasis] = useState<BusinessBasisResult | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricId, setMetricId] = useState('');
  const [definition, setDefinition] = useState<Definition>(emptyDefinition);
  const [chart, setChart] = useState<Chart>('number');
  const [dimension, setDimension] = useState('');
  const [title, setTitle] = useState('');
  const chartHost = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<{ resize: (options: { width: number }) => void } | null>(null);
  const resizePreviewChart = () => {
    const width = chartHost.current?.getBoundingClientRect().width;
    if (width && chartInstance.current) chartInstance.current.resize({ width: Math.floor(width) });
  };
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
    setProfile(current => (current?.sourceId === Number(sourceId) ? current : null));
    setMetrics([]);
    setPreview(null);
    const load = async () => {
      try {
        if (!sourceId) {
          const list = unwrap<Source[]>(await get('/bi/sources', undefined, { signal: abort.signal }));
          if (revision.current === token && currentSession()) setSources(list);
        } else {
          const [nextProfile, saved, sourceList, business] = await Promise.all([
            get(`/bi/sources/${encodeURIComponent(sourceId)}/profile`, undefined, { signal: abort.signal }).then(
              unwrap<Profile>,
            ),
            get('/bi/metrics', { sourceId: Number(sourceId) }, { signal: abort.signal }).then(unwrap<Metric[]>),
            get('/bi/sources', undefined, { signal: abort.signal })
              .then(unwrap<Source[]>)
              .then(list => {
                if (revision.current === token && currentSession()) setSources(list);
                return list;
              }),
            fetchBusinessBasis(Number(sourceId), abort.signal),
          ]);
          if (revision.current === token && currentSession()) {
            if (
              business.sourceRevision !== nextProfile.dataVersion ||
              business.businessColumns.length !== nextProfile.columns?.length ||
              business.businessColumns.some(c => !nextProfile.columns?.some(n => n.name === c.name && n.type === c.type))
            )
              throw new Error('source changed');
            setSources(sourceList);
            setProfile(nextProfile);
            setBasis(business);
            setMetrics(saved);
          }
        }
      } catch {
        if (revision.current === token && currentSession()) {
          setProfile(null);
          setBasis(null);
          setError('데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
        }
      } finally {
        if (revision.current === token && currentSession()) {
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

  useEffect(() => {
    if (!preview || chart === 'number' || !chartHost.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resizePreviewChart);
    observer.observe(chartHost.current);
    return () => observer.disconnect();
  }, [preview, chart]);

  const columns =
    basis?.sourceId === Number(sourceId)
      ? basis.businessColumns.map(c => ({ ...profile?.columns?.find(n => n.name === c.name), ...c }))
      : [];
  const columnLabel = (column: (typeof columns)[number]) => businessColumnLabel(column);
  const ready = profile?.supported && profile.status === 'ready';
  const weighted = definition.aggregation === 'WEIGHTED_AVG';
  const ratio = definition.aggregation === 'RATIO_SUM';
  const numericColumns = columns.filter(column => column.numeric);
  const eligibleColumns = columns.filter(
    column => !['SUM', 'AVG', 'MIN', 'MAX', 'WEIGHTED_AVG', 'RATIO_SUM'].includes(definition.aggregation) || column.numeric,
  );
  const dimensions = columns.filter(column => (chart === 'line' ? column.temporal : !column.numeric && !column.temporal));
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
    setDefinition(current => ({ ...current, ...patch, businessBasis: basis?.businessBasis }));
  };
  const body = {
    sourceId: Number(sourceId),
    metricId: Number(metricId),
    chart,
    businessBasis: basis?.businessBasis,
    title: title.trim(),
    ...(chart === 'number' ? {} : { dimension }),
  };
  const run = async (action: 'metric' | 'preview' | 'dashboard') => {
    if (!currentSession()) {
      setError('로그인 문맥이 변경됐습니다. 입력을 보존했습니다. 페이지를 다시 확인하세요.');
      return;
    }
    if (
      pending.current ||
      (action === 'metric' && profile?.access?.edit === false) ||
      (action === 'dashboard' && profile?.owned === false)
    )
      return;
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
              businessBasis: basis?.businessBasis,
              sourceId: Number(sourceId),
              label: definition.label.trim(),
              column: definition.aggregation === 'COUNT' ? '*' : definition.column,
            },
            { signal: abort.signal },
          ),
        );
        if (token !== revision.current || !currentSession()) return;
        assertOptionalBusinessBasis(saved.definition);
        if (basis?.businessBasis && saved.definition?.businessBasis === undefined) throw new Error('missing saved basis');
        setMetrics(current => [...current.filter(metric => metric.id !== saved.id), saved]);
        setMetricId(String(saved.id));
        setDefinition(saved.definition);
        setPreview(null);
      } else if (action === 'preview') {
        setPreview(null);
        const result = unwrap<Preview>(await post('/bi/preview', body, { signal: abort.signal }));
        if (token === revision.current && currentSession()) setPreview(result);
      } else {
        const saved = unwrap<{ id: number; revision: string }>(await post('/bi/dashboards', body, { signal: abort.signal }));
        if (token === revision.current && currentSession()) navigate(`/dashboard/${saved.id}`);
      }
    } catch (e: unknown) {
      const serverMessage = (e as { response?: { data?: { data?: unknown } } })?.response?.data?.data;
      if (token === revision.current && currentSession())
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
      if (token === revision.current && currentSession()) {
        pending.current = false;
        setBusy('');
      }
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] px-4 pt-4 pb-10 md:px-8 md:pt-4 md:pb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">SQL 없이 차트 만들기</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(`/explore/source${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`)}
        >
          지표 탐색
        </Button>
      </div>
      <p className="mb-6 text-muted-foreground">저장된 파일의 열을 선택해 지표와 차트를 만들고 대시보드에 저장하세요.</p>
      {ready && profile.engine === 'duckdb' && profile.owned !== false && !busy && (
        <Button variant="outline" className="mb-4" onClick={() => navigate(`/dashboard?aiSourceId=${profile.sourceId}`)}>
          {useAiLabel}
        </Button>
      )}
      <p role="status" aria-live="polite" className="mb-2">
        {busy}
      </p>
      {error && (
        <Notice severity="error" className="mb-4">
          <span className="break-words">{error}</span>
          <Button
            variant="ghost"
            className="ml-2"
            disabled={!!busy}
            onClick={() => {
              invalidate();
              setMetricId('');
              setReload(value => value + 1);
            }}
          >
            데이터 다시 불러오기
          </Button>
        </Notice>
      )}
      <div className="flex flex-col gap-6">
        <Card className="min-w-0 p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">1. 데이터 확인</h2>
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
            <Notice severity="info" className="mt-4">
              저장된 데이터가 없습니다.{' '}
              <Button variant="ghost" onClick={() => navigate('/data/file')}>
                파일 저장하러 가기
              </Button>
            </Notice>
          )}
          {profile && !ready && (
            <Notice severity="warning" className="mt-4">
              아직 분석할 수 없는 데이터입니다. 현재는 서버에 저장된 DuckDB 파일 데이터만 지원합니다.
            </Notice>
          )}
          {ready && (
            <>
              <p className="my-4">
                저장된 전체 행 수: {profile.rowCount} · 데이터 버전: {profile.dataVersion.slice(0, 12)}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                {profile.storedAt ? `서버 저장 시각: ${new Date(profile.storedAt).toLocaleString('ko-KR')}. ` : ''}
                날짜 범위는 데이터 기준입니다. 빈 값은 0이 아니며, 합계·평균 등은 빈 값을 제외하고 행 수는 전체 행을 셉니다.
              </p>
              <div
                tabIndex={0}
                role="region"
                aria-label="데이터 프로필과 원본 샘플 표"
                className="min-w-0 max-w-full overflow-x-auto"
              >
                <Table style={{ width: '100%', minWidth: 480 }}>
                  <TableCaption className="mt-0 mb-1 text-left text-inherit">저장된 데이터 프로필</TableCaption>
                  <TableHeader className="[&_tr]:border-0">
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableHead scope="col" className="h-auto border-b p-2 text-left wrap-anywhere">
                        열
                      </TableHead>
                      <TableHead scope="col" className="h-auto border-b p-2 text-left wrap-anywhere">
                        타입
                      </TableHead>
                      <TableHead scope="col" className="h-auto border-b p-2 text-left wrap-anywhere">
                        빈 값 수
                      </TableHead>
                      <TableHead scope="col" className="h-auto border-b p-2 text-left wrap-anywhere">
                        날짜 범위
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map(column => (
                      <TableRow key={column.name} className="border-0 hover:bg-transparent">
                        <TableHead scope="row" className="h-auto border-b p-2 text-left align-top font-normal wrap-anywhere">
                          {columnLabel(column)}
                        </TableHead>
                        <TableCell className="border-b p-2 text-left wrap-anywhere">{column.type}</TableCell>
                        <TableCell className="border-b p-2 text-left wrap-anywhere">{text(column.nullCount)}</TableCell>
                        <TableCell className="border-b p-2 text-left wrap-anywhere">
                          {column.temporal ? `${column.min ?? '—'} ~ ${column.max ?? '—'}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Table style={{ width: '100%', minWidth: 480, marginTop: 16 }}>
                  <TableCaption className="mt-4 mb-1 text-left text-inherit">
                    원본 샘플 · 처음 최대 5행 (전체 집계 결과가 아닙니다)
                  </TableCaption>
                  <TableHeader className="[&_tr]:border-0">
                    <TableRow className="border-0 hover:bg-transparent">
                      {columns.map(column => (
                        <TableHead scope="col" key={column.name} className="h-auto border-b p-2 text-left wrap-anywhere">
                          {columnLabel(column)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(profile.preview ?? []).slice(0, 5).map((row, index) => (
                      <TableRow key={index} className="border-0 hover:bg-transparent">
                        {columns.map(column => (
                          <TableCell key={column.name} className="border-b p-2 text-left wrap-anywhere">
                            {text(row[column.name])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {profile.engine?.toLowerCase() === 'duckdb' && profile.owned !== false && (
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
            <Card className="min-w-0 p-4 md:p-6">
              <h2 className="mb-4 text-lg font-semibold">2. 지표 저장 또는 재사용</h2>
              <BusinessBasisDetails basis={metricId ? definition.businessBasis : basis?.businessBasis} />
              <div className="flex flex-col gap-4">
                <Select
                  label="저장된 지표"
                  value={metricId}
                  disabled={!!busy}
                  onChange={value => {
                    invalidate();
                    setMetricId(value);
                    const saved = metrics.find(metric => String(metric.id) === value);
                    setDefinition(
                      saved
                        ? saved.definition
                        : { ...emptyDefinition, sourceId: Number(sourceId), businessBasis: basis?.businessBasis },
                    );
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
                />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Select
                    label="집계 방법"
                    value={definition.aggregation}
                    disabled={!!busy}
                    onChange={value =>
                      changeDefinition({
                        aggregation: value as Aggregation,
                        unit: '',
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
                    onChange={value =>
                      changeDefinition({
                        column: value,
                        ...(!['COUNT', 'COUNT_DISTINCT', 'RATIO_SUM'].includes(definition.aggregation)
                          ? { unit: columns.find(c => c.name === value)?.unit ?? '' }
                          : {}),
                      })
                    }
                  >
                    {definition.aggregation === 'COUNT' ? (
                      <option value="*">전체 행 (*)</option>
                    ) : (
                      <>
                        <option value="">열을 선택하세요</option>
                        {eligibleColumns.map(column => (
                          <option key={column.name} value={column.name}>
                            {columnLabel(column)}
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
                          {columnLabel(column)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
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
                  <p className="text-sm text-muted-foreground">
                    계산식: SUM(값 × 가중치) / SUM(가중치). 값과 가중치가 모두 있는 행만 포함하며, 둘 중 하나라도 빈
                    값(NULL)이면 해당 행을 제외합니다. 가중치 합계가 0이거나 음수 가중치가 있으면 해당 그룹의 결과는 값
                    없음(NULL, —)입니다.
                  </p>
                )}
                {ratio && (
                  <p className="text-sm text-muted-foreground">
                    계산식: SUM(분자) / SUM(분모) × {definition.scale ?? 1}. 분자와 분모는 각각 자신의 빈 값(NULL)을 제외하고
                    합산합니다. 분모 합계가 0이거나 어느 한쪽에 값이 없으면 결과는 값 없음(NULL, —)입니다.
                  </p>
                )}
                <div className="flex flex-col gap-4 sm:flex-row">
                  <TextField
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
                </div>
                <Button
                  disabled={!!busy || !validMetric || !!metricId || profile?.access?.edit === false}
                  onClick={() => void run('metric')}
                >
                  지표 저장
                </Button>
                <p className="text-sm text-muted-foreground">
                  {metricId
                    ? '저장된 지표를 사용합니다. 내용을 변경하면 새 지표로 저장할 수 있습니다.'
                    : '먼저 지표를 저장한 뒤 결과를 확인하세요. 합계·평균·최솟값·최댓값·가중 평균·합계 비율은 숫자 열만 선택할 수 있습니다.'}
                </p>
              </div>
            </Card>
            <Card className="min-w-0 p-4 md:p-6">
              <h2 className="mb-4 text-lg font-semibold">3. 차트 결과 확인</h2>
              <div className="flex flex-col gap-4">
                <TextField
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
                        {columnLabel(column)}
                      </option>
                    ))}
                  </Select>
                )}
                {chart !== 'number' && dimensions.length === 0 && (
                  <Notice severity="info">
                    이 차트에 사용할 {chart === 'line' ? '날짜' : '범주'} 열이 없습니다. 다른 차트 종류를 선택하세요.
                  </Notice>
                )}
                <Button
                  variant="outline"
                  disabled={!!busy || !metricId || !validMetric || !validChart}
                  onClick={() => void run('preview')}
                >
                  결과 미리보기
                </Button>
                {preview && (
                  <div tabIndex={0} role="region" aria-label="집계 결과 표" className="min-w-0 max-w-full overflow-x-auto">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    {chart === 'number' ? (
                      <div className="h-[155px]">
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
                      </div>
                    ) : (
                      <div ref={chartHost} className="min-w-0 w-full">
                        <React.Suspense fallback={<p>차트 불러오는 중…</p>}>
                          <ChartPreview
                            onChartReady={instance => {
                              chartInstance.current = instance;
                              resizePreviewChart();
                            }}
                            theme={chartTheme}
                            style={{ height: 280, width: '100%' }}
                            option={{
                              color: [chartColors.primary],
                              animation: false,
                              grid: { left: 16, right: 16, bottom: 48, top: 24, containLabel: true },
                              tooltip: { trigger: 'axis' },
                              xAxis: {
                                type: 'category',
                                data: preview.rows.map(row => text(row.dimension)),
                                axisLabel: { color: chartColors.muted, hideOverlap: true },
                              },
                              yAxis: { type: 'value', axisLabel: { color: chartColors.muted } },
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
                      </div>
                    )}
                    <Table style={{ width: '100%' }}>
                      <TableCaption className="mt-0 mb-1 text-left text-inherit">
                        {chart === 'number' ? '실제 집계 결과' : `최대 ${preview.limit ?? 500}개 그룹`}
                        {` · ${preview.rows.length}개 결과 · ${
                          preview.complete ? '전체 결과' : '일부 결과 (전체가 아닐 수 있습니다)'
                        }`}
                      </TableCaption>
                      <TableHeader className="[&_tr]:border-0">
                        <TableRow className="border-0 hover:bg-transparent">
                          {chart !== 'number' && (
                            <TableHead scope="col" className="h-auto border-b p-2 text-left wrap-anywhere">
                              {dimension}
                            </TableHead>
                          )}
                          <TableHead scope="col" className="h-auto border-b p-2 text-right tabular-nums wrap-anywhere">
                            {preview.metric.label}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row, index) => (
                          <TableRow key={index} className="border-0 hover:bg-transparent">
                            {chart !== 'number' && (
                              <TableCell className="border-b p-2 text-left wrap-anywhere">{text(row.dimension)}</TableCell>
                            )}
                            <TableCell className="border-b p-2 text-right tabular-nums wrap-anywhere">
                              {text(row.value)}
                              {preview.metric.unit ? ` ${preview.metric.unit}` : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {preview.rows.length === 0 && <p>집계 결과가 없습니다.</p>}
                    <p className="mt-2 text-sm">
                      데이터 버전: {preview.sourceRevision.slice(0, 12)} · 지표 버전: {preview.definitionVersion}
                    </p>
                  </div>
                )}
                <Button
                  disabled={!!busy || !preview || !metricId || !validMetric || !validChart || profile?.owned === false}
                  onClick={() => void run('dashboard')}
                >
                  대시보드 저장
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
