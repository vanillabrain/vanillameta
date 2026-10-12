import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ReactECharts from 'echarts-for-react';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';
import { get, post, postForm, put } from '@/helpers/apiHelper';
import type { CommercePresentation, CommerceProject, CommerceReport } from './types';

const BLUE = '#0f5ab2';
const CURRENCY = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const AXIS_CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const numberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const formatMoney = (value: unknown) => {
  const parsed = numberValue(value);
  return parsed === null ? '—' : CURRENCY.format(parsed);
};
const unwrap = response => response?.data?.data ?? response?.data;
const errorText = error => {
  const body = error?.response?.data;
  return (
    (typeof body === 'string' && body) || body?.message || body?.error || error?.message || '요청을 완료하지 못했습니다.'
  );
};
const validReport = (value: any): value is CommerceReport => {
  const numeric = item => item !== null && item !== undefined && Number.isFinite(Number(item));
  return Boolean(
    value &&
      typeof value === 'object' &&
      value.project &&
      value.summary &&
      ['paymentTotal', 'refundTotal', 'netCollected', 'paidOrders', 'refundedOrders'].every(key =>
        numeric(value.summary[key]),
      ) &&
      (value.summary.refundOrderRate === null || numeric(value.summary.refundOrderRate)) &&
      Array.isArray(value.daily) &&
      value.daily.every(
        item =>
          item &&
          typeof item.date === 'string' &&
          ['paymentTotal', 'refundTotal', 'netCollected'].every(key => numeric(item[key])),
      ) &&
      Array.isArray(value.channels) &&
      value.channels.every(
        item =>
          item &&
          typeof item.channel === 'string' &&
          ['paymentTotal', 'refundTotal', 'netCollected'].every(key => numeric(item[key])),
      ) &&
      Array.isArray(value.reasons) &&
      value.reasons.every(
        item => item && typeof item.reason === 'string' && numeric(item.refundTotal) && numeric(item.refunds),
      ) &&
      Array.isArray(value.orders) &&
      value.orders.length <= 100 &&
      value.orders.every(
        item =>
          item &&
          typeof item.orderId === 'string' &&
          ['orderedAt', 'channel', 'orderStatus'].every(key => typeof item[key] === 'string') &&
          ['paidAmount', 'refundAmount', 'netCollected'].every(key => numeric(item[key])),
      ) &&
      Array.isArray(value.availableChannels) &&
      value.availableChannels.every(item => typeof item === 'string'),
  );
};

// Preview only the first few CSV records for user feedback; the browser never parses or aggregates the dataset.
const previewCsv = async (file: File) => {
  const text = await file.slice(0, 64 * 1024).text();
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < 6; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
  }
  return {
    headers: rows[0] ?? [],
    samples: rows.slice(1, 6),
    truncated: file.size > 64 * 1024,
  };
};

function Commerce() {
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CommerceProject[]>([]);
  const [selectedId, setSelectedId] = useState(routeProjectId ?? '');
  const [projectName, setProjectName] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({
    orders: null,
    payments: null,
    refunds: null,
    customers: null,
  });
  const [previews, setPreviews] = useState<Record<string, Awaited<ReturnType<typeof previewCsv>>>>({});
  const [report, setReport] = useState<CommerceReport | null>(null);
  const [reportScope, setReportScope] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [projectsBusy, setProjectsBusy] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const [importOpen, setImportOpen] = useState(!routeProjectId);
  const [importTargetId, setImportTargetId] = useState(routeProjectId ?? '');
  const [pageError, setPageError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [channel, setChannel] = useState('');
  const [appliedScope, setAppliedScope] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('매출과 환불 추이를 간결하게 설명하고 제목을 다듬어 주세요.');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [draft, setDraft] = useState<CommercePresentation | null>(null);
  const [presentation, setPresentation] = useState<CommercePresentation>({});
  const [showAllOrders, setShowAllOrders] = useState(false);
  const reportRequest = useRef(0);
  const projectRequest = useRef(0);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadProjects = useCallback(async () => {
    projectRequest.current += 1;
    const requestId = projectRequest.current;
    setProjectsBusy(true);
    try {
      const response = await get('/commerce');
      const value = unwrap(response);
      if (requestId !== projectRequest.current) return;
      if (!Array.isArray(value)) throw new Error('프로젝트 목록 응답 형식이 올바르지 않습니다.');
      setProjects(value);
      setPageError('');
      if (routeProjectId && !value.some((project: CommerceProject) => String(project.id) === routeProjectId)) {
        setPageError('프로젝트를 찾을 수 없거나 접근 권한이 없습니다.');
      }
    } catch (error) {
      if (requestId === projectRequest.current) setPageError(String(errorText(error)));
    } finally {
      if (requestId === projectRequest.current) setProjectsBusy(false);
    }
  }, [routeProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  useEffect(() => {
    setSelectedId(routeProjectId ?? '');
    setImportTargetId(routeProjectId ?? '');
    setImportOpen(!routeProjectId);
  }, [routeProjectId]);

  const fetchReport = useCallback(
    async (id: string, filters: { start?: string; end?: string; channel?: string } = {}) => {
      reportRequest.current += 1;
      const requestId = reportRequest.current;
      setReportBusy(true);
      setPageError('');
      try {
        const params: Record<string, string> = {};
        if (filters.start) params.start = filters.start;
        if (filters.end) params.end = filters.end;
        if (filters.channel) params.channel = filters.channel;
        const response = await get(`/commerce/${encodeURIComponent(id)}/report`, params);
        const value = unwrap(response);
        if (!validReport(value)) throw new Error('리포트 응답 형식이 올바르지 않습니다.');
        if (requestId !== reportRequest.current) return;
        setReport(value);
        const scope = (value.scope && typeof value.scope === 'object' ? value.scope : {}) as Record<string, any>;
        const range = (value.range && typeof value.range === 'object' ? value.range : {}) as Record<string, any>;
        const actualStart = scope.start || range.start || filters.start;
        const actualEnd = scope.end || range.end || filters.end;
        const actualChannel = scope.channel || filters.channel;
        const actualTimezone = scope.timezone || range.timezone || 'UTC';
        const readableRange = actualStart && actualEnd ? `${actualStart} ~ ${actualEnd} (${actualTimezone})` : '전체 기간';
        setReportScope(`${readableRange}${actualChannel ? ` · ${actualChannel}` : ' · 전체 채널'}`);
        setAppliedScope(JSON.stringify(filters));
        setPresentation((value.project as any)?.presentation ?? {});
      } catch (error) {
        if (requestId === reportRequest.current) {
          setPageError(
            `${String(errorText(error))}${
              report
                ? ` 이전 결과(${reportScope || '이전 조회 범위'})는 그대로 표시 중이며 현재 필터는 적용되지 않았습니다.`
                : ''
            }`,
          );
        }
      } finally {
        if (requestId === reportRequest.current) setReportBusy(false);
      }
    },
    [report, reportScope],
  );

  useEffect(() => {
    if (routeProjectId) fetchReport(routeProjectId);
    // A route change intentionally loads the default report once; filter changes use the explicit Apply button.
  }, [routeProjectId]);

  const selectedProject = projects.find(project => String(project.id) === selectedId);
  const onPickFile = async (key: string, file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setPageError('CSV 파일만 업로드할 수 있습니다.');
      return;
    }
    setFiles(previous => ({ ...previous, [key]: file }));
    try {
      const preview = await previewCsv(file);
      setPreviews(previous => ({ ...previous, [key]: preview }));
    } catch {
      setPageError(`${file.name} 미리보기를 읽지 못했습니다.`);
    }
  };

  const upload = async () => {
    if (!files.orders || !files.payments || !files.refunds || (!importTargetId && !projectName.trim())) {
      setPageError('새 프로젝트 이름과 주문·결제·환불 CSV를 입력·선택해 주세요.');
      return;
    }
    setUploadBusy(true);
    setPageError('');
    setImportFeedback('');
    try {
      const form = new FormData();
      const targetProject = projects.find(project => String(project.id) === importTargetId);
      form.append('name', projectName.trim() || targetProject?.name || '매출·환불 프로젝트');
      if (importTargetId) form.append('projectId', importTargetId);
      form.append('orders', files.orders);
      form.append('payments', files.payments);
      form.append('refunds', files.refunds);
      if (files.customers) form.append('customers', files.customers);
      const response = await postForm('/commerce/import', form, { timeout: 300000 });
      const value = unwrap(response);
      if (value?.status === 'ERROR' || value?.validation?.valid === false || value?.validation?.ok === false) {
        const counts = value?.counts || value?.rows;
        const diagnostics = value?.validation?.errors || value?.errors || [];
        setImportFeedback(
          `가져오기가 검증에서 거부되었습니다.${counts ? ` 파일 건수: ${JSON.stringify(counts)}.` : ''}${
            diagnostics.length
              ? ` 확인 항목: ${diagnostics
                  .map(item =>
                    typeof item === 'string' ? item : item.detail || item.message || item.code || JSON.stringify(item),
                  )
                  .join(' · ')}`
              : ''
          }`,
        );
        return;
      }
      const id = value?.projectId ?? value?.project?.id ?? value?.id ?? importTargetId;
      const counts = value?.counts || value?.rows || value?.validation?.counts;
      if (value?.changed === false) setImportFeedback(`동일한 데이터입니다. 버전 ${value.version}을 유지했습니다.`);
      if (counts)
        setImportFeedback(
          `검증 통과 · 파일 행 수: ${Object.entries(counts)
            .map(([key, count]) => `${key} ${count}`)
            .join(' · ')}${value?.sampleType ? ` · 샘플 유형: ${value.sampleType}` : ''}`,
        );
      await loadProjects();
      if (id != null) {
        setSelectedId(String(id));
        navigate(`/commerce/${id}`);
        await fetchReport(String(id));
      } else {
        setPageError('가져오기는 완료했지만 응답에 projectId가 없습니다. 프로젝트 목록에서 새 프로젝트를 선택해 주세요.');
      }
    } catch (error) {
      const body = error?.response?.data;
      const validation = body?.validation ?? body?.data?.validation;
      const diagnostics = validation
        ? ` 검증 오류 ${validation.errorCount}건. ${validation.errors
            .slice(0, 10)
            .map(item => `${item.code}: ${item.rowId}`)
            .join(' · ')}`
        : '';
      setPageError(
        `가져오기에 실패했습니다: ${String(errorText(error))}${diagnostics}${
          report ? ` 이전 리포트(${reportScope})는 유지했습니다.` : ''
        }`,
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const applyFilters = () => {
    if (Boolean(start) !== Boolean(end)) {
      setPageError('시작일과 종료일을 모두 입력하거나 모두 비워 주세요.');
      return;
    }
    if (
      start &&
      end &&
      (Number.isNaN(Date.parse(`${start}T00:00:00Z`)) || Number.isNaN(Date.parse(`${end}T00:00:00Z`)) || start > end)
    ) {
      setPageError('올바른 UTC 날짜 범위를 입력해 주세요.');
      return;
    }
    if (selectedId) fetchReport(selectedId, { start, end, channel });
  };
  const resetFilters = () => {
    setStart('');
    setEnd('');
    setChannel('');
    if (selectedId) fetchReport(selectedId);
  };
  const chooseProject = id => {
    setSelectedId(String(id));
    setImportTargetId(String(id));
    navigate(`/commerce/${id}`);
  };

  const dailyOption = useMemo(
    () => ({
      color: [BLUE, '#e06a63', '#43a482'],
      tooltip: { trigger: 'axis', valueFormatter: value => CURRENCY.format(Number(value)) },
      legend: { data: ['결제액', '환불액', '차감 수취액'], bottom: 0 },
      grid: { left: 55, right: 20, top: 24, bottom: 64 },
      xAxis: {
        type: 'category',
        data: report?.daily.map(item => item.date) ?? [],
        axisLabel: {
          hideOverlap: true,
          showMaxLabel: false,
          formatter: value => (report?.daily.length > 90 ? value.slice(0, 7) : value.slice(5)),
        },
      },
      yAxis: { type: 'value', axisLabel: { formatter: value => AXIS_CURRENCY.format(Number(value)) } },
      series: [
        {
          name: '결제액',
          type: 'line',
          smooth: true,
          data: report?.daily.map(item => numberValue(item.paymentTotal)) ?? [],
        },
        { name: '환불액', type: 'line', smooth: true, data: report?.daily.map(item => numberValue(item.refundTotal)) ?? [] },
        {
          name: '차감 수취액',
          type: 'line',
          smooth: true,
          data: report?.daily.map(item => numberValue(item.netCollected)) ?? [],
        },
      ],
    }),
    [report],
  );
  const channelsOption = useMemo(() => {
    const rows = [...(report?.channels ?? [])].sort(
      (a, b) => (numberValue(a.netCollected) ?? 0) - (numberValue(b.netCollected) ?? 0),
    );
    return {
      color: [BLUE],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => CURRENCY.format(Number(value)) },
      grid: { left: 92, right: 20, top: 16, bottom: 28 },
      xAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: { hideOverlap: true, formatter: value => AXIS_CURRENCY.format(Number(value)) },
      },
      yAxis: { type: 'category', data: rows.map(row => row.channel), axisLabel: { width: 84, overflow: 'break' } },
      series: [
        {
          name: '차감 수취액',
          type: 'bar',
          data: rows.map(row => numberValue(row.netCollected)),
          barMaxWidth: 26,
          label: { show: false },
        },
      ],
    };
  }, [report]);

  const openAi = () => {
    setAiError('');
    setDraft(null);
    setAiOpen(true);
  };
  const requestAi = async () => {
    if (!selectedId || !aiPrompt.trim()) return;
    setAiBusy(true);
    setAiError('');
    setDraft(null);
    try {
      const applied = JSON.parse(appliedScope || '{}');
      const response = await post(
        `/commerce/${encodeURIComponent(selectedId)}/ai`,
        {
          prompt: aiPrompt.trim(),
          currentPresentation: presentation,
          start: applied.start || undefined,
          end: applied.end || undefined,
          channel: applied.channel || undefined,
        },
        { timeout: 180000 },
      );
      const value = unwrap(response);
      if (
        !value?.draft ||
        typeof value.draft.title !== 'string' ||
        typeof value.draft.explanation !== 'string' ||
        typeof value.draft.chartTitle !== 'string'
      ) {
        throw new Error('AI 초안 응답에 제목·설명·차트 제목이 모두 필요합니다.');
      }
      setAiModel(typeof value.requestedModel === 'string' ? value.requestedModel : '');
      setDraft(value.draft);
    } catch (error) {
      setAiError(String(errorText(error)));
    } finally {
      setAiBusy(false);
    }
  };
  const saveDraft = async () => {
    if (!selectedId || !draft) return;
    setAiBusy(true);
    setAiError('');
    try {
      const response = await put(`/commerce/${encodeURIComponent(selectedId)}/presentation`, { presentation: draft });
      const value = unwrap(response);
      setPresentation(value?.presentation ?? draft);
      setAiOpen(false);
      setDraft(null);
      await fetchReport(selectedId, JSON.parse(appliedScope || '{}'));
    } catch (error) {
      setAiError(`저장하지 못했습니다: ${String(errorText(error))}`);
    } finally {
      setAiBusy(false);
    }
  };

  const heading = report?.project?.name || selectedProject?.name || '매출·환불 분석';
  const latestOrders = showAllOrders ? report?.orders ?? [] : (report?.orders ?? []).slice(0, 12);
  const fileLabel: Record<string, string> = {
    orders: '주문 CSV',
    payments: '결제 CSV',
    refunds: '환불 CSV',
    customers: '고객 CSV (선택)',
  };
  const presentationTitle = presentation.title || heading;

  return (
    <PageTitleBox
      title="매출·환불"
      upperTitle="데이터"
      upperTitleLink="/data"
      sx={{ px: { xs: 1.5, sm: 3 }, width: '100%', boxSizing: 'border-box' }}
    >
      <Seo title="매출·환불 MVP" />
      <Stack spacing={2.25} sx={{ width: '100%', maxWidth: 1440, mx: 'auto', py: 2, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#17324d', overflowWrap: 'anywhere' }}>
              {presentationTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              결제 이벤트 기준 매출 · 환불 이벤트 기준 환불
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 240 } }}>
              <InputLabel id="commerce-project-label">프로젝트</InputLabel>
              <Select
                labelId="commerce-project-label"
                label="프로젝트"
                value={selectedId}
                onChange={event => chooseProject(event.target.value)}
              >
                <MenuItem value="">프로젝트 선택</MenuItem>
                {projects.map(project => (
                  <MenuItem
                    key={project.id}
                    value={String(project.id)}
                    sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                  >
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {report && (
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeOutlinedIcon />}
                onClick={openAi}
                sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
              >
                AI로 설명·제목 편집
              </Button>
            )}
          </Stack>
        </Stack>

        {pageError && (
          <Alert severity="error" onClose={() => setPageError('')} sx={{ overflowWrap: 'anywhere' }}>
            {pageError}
          </Alert>
        )}
        {importFeedback && (
          <Alert severity="success" onClose={() => setImportFeedback('')} sx={{ overflowWrap: 'anywhere' }}>
            {importFeedback}
          </Alert>
        )}
        {projectsBusy && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={18} />
            <Typography>프로젝트를 불러오는 중…</Typography>
          </Stack>
        )}

        {report && (
          <Button
            variant="outlined"
            onClick={() => setImportOpen(value => !value)}
            aria-expanded={importOpen}
            sx={{ alignSelf: 'flex-start', minHeight: 40 }}
          >
            {importOpen ? '데이터 가져오기 닫기' : '데이터 가져오기 / 교체'}
          </Button>
        )}

        {importOpen && (
          <Card variant="outlined" sx={{ borderColor: '#dce5ee', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={0.5}>
                주문·결제·환불 데이터 가져오기
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                CSV 파일을 서버 DuckDB 워커로 가져옵니다. 실패하면 기존 프로젝트 리포트는 유지됩니다.
              </Typography>
              <Stack spacing={1.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="commerce-import-target-label">가져올 대상</InputLabel>
                  <Select
                    labelId="commerce-import-target-label"
                    label="가져올 대상"
                    value={importTargetId}
                    onChange={event => setImportTargetId(event.target.value)}
                  >
                    <MenuItem value="">새 프로젝트</MenuItem>
                    {projects.map(project => (
                      <MenuItem
                        key={project.id}
                        value={String(project.id)}
                        sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                      >
                        {project.name}에 교체 가져오기
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="프로젝트 이름"
                  value={projectName}
                  onChange={event => setProjectName(event.target.value)}
                  fullWidth
                  inputProps={{ 'aria-label': '프로젝트 이름' }}
                  helperText={
                    importTargetId ? '비워 두면 선택한 프로젝트 이름을 사용합니다.' : '새 프로젝트에 표시할 이름입니다.'
                  }
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                  {Object.entries(fileLabel).map(([key, label]) => {
                    const preview = previews[key];
                    return (
                      <Card key={key} variant="outlined" sx={{ minWidth: 0, borderRadius: 1.5 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack spacing={1}>
                            <Typography fontWeight={600}>
                              {label}
                              {key !== 'customers' && (
                                <Box component="span" color="error.main">
                                  {' '}
                                  *
                                </Box>
                              )}
                            </Typography>
                            <input
                              ref={element => {
                                fileInputRefs.current[key] = element;
                              }}
                              hidden
                              type="file"
                              accept=".csv,text/csv"
                              aria-label={`${label} 파일 선택`}
                              onChange={event => onPickFile(key, event.target.files?.[0])}
                            />
                            <Button
                              variant="outlined"
                              fullWidth
                              startIcon={<UploadFileOutlinedIcon />}
                              onClick={() => fileInputRefs.current[key]?.click()}
                              aria-label={`${label} 선택`}
                              sx={{ minHeight: 44, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                            >
                              {files[key]?.name || `${label} 선택`}
                            </Button>
                            {preview && (
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  헤더 {preview.headers.length}개 · 미리보기 {preview.samples.length}행
                                  {' · 전체 행 수는 서버 검증 후 표시'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="div"
                                  sx={{ overflowWrap: 'anywhere', color: '#34516c' }}
                                >
                                  열: {preview.headers.join(' · ') || '헤더 없음'}
                                </Typography>
                                <Box component="details" sx={{ mt: 0.5 }}>
                                  <Box component="summary" sx={{ cursor: 'pointer', color: BLUE, fontSize: 12 }}>
                                    표본 행 내용 보기
                                  </Box>
                                  <Typography
                                    component="pre"
                                    variant="caption"
                                    sx={{
                                      mt: 0.5,
                                      mb: 0,
                                      whiteSpace: 'pre-wrap',
                                      overflowWrap: 'anywhere',
                                      maxHeight: 120,
                                      overflow: 'auto',
                                      bgcolor: '#f5f8fb',
                                      p: 0.75,
                                      borderRadius: 1,
                                    }}
                                  >
                                    {preview.samples
                                      .map(sample => sample.map(value => value.slice(0, 80)).join(' | '))
                                      .join('\n') || '헤더 외 표본 행 없음'}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
                <Button
                  variant="contained"
                  onClick={upload}
                  disabled={uploadBusy}
                  startIcon={uploadBusy ? <CircularProgress size={16} color="inherit" /> : <UploadFileOutlinedIcon />}
                  sx={{ minHeight: 42, alignSelf: { sm: 'flex-start' } }}
                >
                  {uploadBusy ? '가져오는 중…' : 'CSV 가져오기'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && !routeProjectId && !report && (
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              내 프로젝트
            </Typography>
            {projects.map(project => (
              <Button
                key={project.id}
                variant="text"
                onClick={() => chooseProject(project.id)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none', minHeight: 42, overflowWrap: 'anywhere' }}
              >
                {project.name}
              </Button>
            ))}
          </Stack>
        )}

        {report && (
          <>
            <Card variant="outlined" sx={{ bgcolor: '#f8fbff', borderColor: '#d9e6f4', borderRadius: 2 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  조회 범위
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    type="date"
                    label="시작일 (UTC)"
                    size="small"
                    value={start}
                    onChange={event => setStart(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ 'aria-label': '시작일 UTC' }}
                  />
                  <TextField
                    type="date"
                    label="종료일 (UTC)"
                    size="small"
                    value={end}
                    onChange={event => setEnd(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ 'aria-label': '종료일 UTC' }}
                  />
                  <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 } }}>
                    <InputLabel id="commerce-channel-label">채널</InputLabel>
                    <Select
                      labelId="commerce-channel-label"
                      label="채널"
                      value={channel}
                      onChange={event => setChannel(event.target.value)}
                    >
                      <MenuItem value="">전체 채널</MenuItem>
                      {report.availableChannels.map(item => (
                        <MenuItem key={item} value={item} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={applyFilters} disabled={reportBusy} sx={{ minHeight: 40 }}>
                    적용
                  </Button>
                  <Button variant="outlined" onClick={resetFilters} disabled={reportBusy} sx={{ minHeight: 40 }}>
                    초기화
                  </Button>
                </Stack>
                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  표시 결과 범위: {reportScope || '불러오는 중'}
                  {reportBusy ? ' · 새 범위를 조회 중…' : ''}
                </Typography>
              </CardContent>
            </Card>

            <Alert severity="info" icon={false} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Typography variant="body2">
                <b>매출 정의:</b> 결제 성공 이벤트 금액 · <b>환불:</b> 환불 이벤트가 처리된 날의 금액 · <b>차감 수취액:</b>{' '}
                결제액 − 환불액(USD, 세금·배송 포함)입니다.
              </Typography>
              <Typography variant="body2" mt={0.5}>
                주문 수·환불 주문 비율은 주문일 기준 코호트의 확보한 데이터 전체 기간 내 환불 이력이며, 환불액의 추이와 날짜
                기준이 다릅니다. 차감 수취액은 상품 순매출이 아닙니다.
              </Typography>
            </Alert>
            {presentation.explanation && (
              <Alert severity="info" icon={false}>
                {presentation.explanation}
              </Alert>
            )}

            {reportBusy && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={18} />
                <Typography>리포트를 불러오는 중…</Typography>
              </Stack>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(6, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              {[
                ['결제 성공액', formatMoney(report.summary.paymentTotal), '결제 이벤트 기준 · USD'],
                ['환불액', formatMoney(report.summary.refundTotal), '환불 이벤트 기준 · USD'],
                ['차감 수취액', formatMoney(report.summary.netCollected), '상품 순매출 아님 · USD'],
                [
                  '결제 주문',
                  numberValue(report.summary.paidOrders) === null ? '—' : Number(report.summary.paidOrders).toLocaleString(),
                  '결제 성공 주문 수',
                ],
                [
                  '환불 주문',
                  numberValue(report.summary.refundedOrders) === null
                    ? '—'
                    : Number(report.summary.refundedOrders).toLocaleString(),
                  '주문일 코호트 기준',
                ],
                [
                  '환불 주문 비율',
                  numberValue(report.summary.refundOrderRate) === null
                    ? '—'
                    : `${(Number(report.summary.refundOrderRate) * 100).toFixed(2)}%`,
                  '주문일 코호트 기준 · 소수점 둘째 자리',
                ],
              ].map(([label, value, detail]) => (
                <Card key={label} variant="outlined" sx={{ borderColor: '#dce5ee', borderRadius: 2, minWidth: 0 }}>
                  <CardContent sx={{ p: { xs: 1.25, sm: 2 }, '&:last-child': { pb: { xs: 1.25, sm: 2 } } }}>
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      sx={{ color: BLUE, overflowWrap: 'anywhere', fontSize: { xs: '1rem', sm: '1.25rem', lg: '1.1rem' } }}
                    >
                      {value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detail}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(300px, 1fr)' },
                gap: 1.5,
              }}
            >
              <Card variant="outlined" sx={{ minWidth: 0, borderColor: '#dce5ee', borderRadius: 2 }}>
                <CardContent sx={{ minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={700}>
                    {presentation.chartTitle || '매출·환불 추이'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    결제 및 환불 이벤트 날짜별 금액 · USD
                  </Typography>
                  {report.daily.length ? (
                    <ReactECharts
                      option={dailyOption}
                      notMerge
                      style={{ width: '100%', height: 310, maxWidth: '100%' }}
                      aria-label="일별 결제액, 환불액, 차감 수취액 추이"
                    />
                  ) : (
                    <Typography py={6} textAlign="center" color="text.secondary">
                      표시할 일별 데이터가 없습니다.
                    </Typography>
                  )}
                  {report.daily.length > 0 && (
                    <Box component="details" sx={{ mt: 1 }}>
                      <Box component="summary" sx={{ cursor: 'pointer', color: BLUE, fontSize: 14 }}>
                        일별 정확한 수치 표 보기
                      </Box>
                      <Box
                        role="region"
                        aria-label="일별 매출·환불 수치 표 스크롤"
                        tabIndex={0}
                        sx={{ overflow: 'auto', maxHeight: 320, mt: 1 }}
                      >
                        <table
                          aria-label="일별 매출·환불 수치 (USD)"
                          style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}
                        >
                          <thead>
                            <tr>
                              {['날짜 (UTC)', '결제액', '환불액', '차감 수취액'].map(label => (
                                <th
                                  key={label}
                                  scope="col"
                                  style={{
                                    textAlign: 'left',
                                    padding: 6,
                                    position: 'sticky',
                                    top: 0,
                                    background: '#f5f8fb',
                                  }}
                                >
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {report.daily.map(item => (
                              <tr key={item.date}>
                                {[
                                  item.date,
                                  formatMoney(item.paymentTotal),
                                  formatMoney(item.refundTotal),
                                  formatMoney(item.netCollected),
                                ].map((value, index) => (
                                  <td
                                    key={index}
                                    style={{ padding: 6, borderTop: '1px solid #edf0f4', whiteSpace: 'nowrap' }}
                                  >
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 0, borderColor: '#dce5ee', borderRadius: 2 }}>
                <CardContent sx={{ minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={700}>
                    채널별 차감 수취액
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    내림차순 · USD
                  </Typography>
                  {report.channels.length ? (
                    <ReactECharts
                      option={channelsOption}
                      notMerge
                      style={{
                        width: '100%',
                        height: Math.max(220, Math.min(400, report.channels.length * 48 + 70)),
                        maxWidth: '100%',
                      }}
                      aria-label="차감 수취액 기준 채널별 가로 막대 차트"
                    />
                  ) : (
                    <Typography py={6} textAlign="center" color="text.secondary">
                      표시할 채널 데이터가 없습니다.
                    </Typography>
                  )}
                  <Box component="details" sx={{ mt: 1 }}>
                    <Box component="summary" sx={{ cursor: 'pointer', color: BLUE, fontSize: 14 }}>
                      채널별 정확한 수치 표 보기
                    </Box>
                    <Box role="region" aria-label="채널별 수치 표 스크롤" tabIndex={0} sx={{ overflowX: 'auto', mt: 1 }}>
                      <table aria-label="채널별 매출·환불 수치 (USD)" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['채널', '결제액', '환불액', '차감 수취액'].map(label => (
                              <th key={label} scope="col" style={{ textAlign: 'right', padding: 6 }}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...report.channels]
                            .sort((a, b) => (numberValue(b.netCollected) ?? 0) - (numberValue(a.netCollected) ?? 0))
                            .map(item => (
                              <tr key={item.channel}>
                                {[
                                  item.channel,
                                  formatMoney(item.paymentTotal),
                                  formatMoney(item.refundTotal),
                                  formatMoney(item.netCollected),
                                ].map((value, i) => (
                                  <td
                                    key={i}
                                    style={{
                                      textAlign: i ? 'right' : 'left',
                                      padding: 6,
                                      borderTop: '1px solid #edf0f4',
                                      overflowWrap: 'anywhere',
                                    }}
                                  >
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, .7fr) minmax(0, 1.3fr)' },
                gap: 1.5,
              }}
            >
              <Card variant="outlined" sx={{ borderColor: '#dce5ee', borderRadius: 2, minWidth: 0 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} mb={1}>
                    환불 사유
                  </Typography>
                  {report.reasons.length ? (
                    report.reasons.map(item => (
                      <Stack
                        key={item.reason}
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                        sx={{ py: 0.8, borderBottom: '1px solid #edf0f4' }}
                      >
                        <Typography sx={{ overflowWrap: 'anywhere' }}>{item.reason}</Typography>
                        <Typography fontWeight={600} textAlign="right">
                          {formatMoney(item.refundTotal)}{' '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            ({Number(item.refunds).toLocaleString()}건)
                          </Typography>
                        </Typography>
                      </Stack>
                    ))
                  ) : (
                    <Typography color="text.secondary">환불 내역이 없습니다.</Typography>
                  )}
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderColor: '#dce5ee', borderRadius: 2, minWidth: 0 }}>
                <CardContent sx={{ minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mb={1}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        최근 주문
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        최신 100건까지 제공
                      </Typography>
                    </Box>
                    {report.orders.length > 12 && (
                      <Button
                        onClick={() => setShowAllOrders(value => !value)}
                        aria-expanded={showAllOrders}
                        aria-controls="commerce-orders-table"
                        sx={{ flexShrink: 0 }}
                      >
                        {showAllOrders ? '접기' : `전체 ${report.orders.length}건`}
                      </Button>
                    )}
                  </Stack>
                  {report.orders.length ? (
                    <Box
                      role="region"
                      aria-label="최근 주문 표 스크롤"
                      tabIndex={0}
                      sx={{ overflowX: 'auto', maxWidth: '100%' }}
                    >
                      <table
                        id="commerce-orders-table"
                        aria-label="최근 주문 (금액 USD)"
                        style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}
                      >
                        <thead>
                          <tr>
                            {['주문 ID', '주문일', '채널', '상태', '결제액', '환불액', '차감 수취액'].map(label => (
                              <th
                                key={label}
                                scope="col"
                                style={{ textAlign: 'left', padding: 8, background: '#f5f8fb', whiteSpace: 'nowrap' }}
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {latestOrders.map((item, index) => (
                            <tr key={`${item.orderId}-${index}`}>
                              {[
                                item.orderId,
                                item.orderedAt,
                                item.channel,
                                item.orderStatus,
                                formatMoney(item.paidAmount),
                                formatMoney(item.refundAmount),
                                formatMoney(item.netCollected),
                              ].map((value, i) => (
                                <td
                                  key={i}
                                  style={{
                                    padding: 8,
                                    borderTop: '1px solid #edf0f4',
                                    whiteSpace: i < 4 ? 'normal' : 'nowrap',
                                    overflowWrap: i < 4 ? 'anywhere' : undefined,
                                  }}
                                >
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">표시할 주문이 없습니다.</Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
            <Divider />
            {report.project && (
              <Typography variant="caption" color="text.secondary">
                프로젝트: {report.project.name} · 리포트 데이터는 서버에서 계산했습니다. 검증 샘플 출처:{' '}
                <a href="https://www.analyticsengineering.com/datasets/ecommerce-sales" target="_blank" rel="noreferrer">
                  Analytics Engineering Ecommerce Sales &amp; Returns
                </a>{' '}
                (합성 데이터, CC BY 4.0). 업로드 데이터의 출처는 별도로 확인해 주세요.
              </Typography>
            )}
          </>
        )}
      </Stack>

      <Dialog
        open={aiOpen}
        onClose={() => {
          if (!aiBusy) {
            setAiOpen(false);
            setDraft(null);
          }
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="commerce-ai-title"
      >
        <DialogTitle id="commerce-ai-title">AI로 설명·제목 편집</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            현재 리포트 표현의 제목·설명만 제안합니다. 매출·환불 계산 기준은 변경하지 않습니다.
          </Typography>
          <TextField
            autoFocus
            label="편집 요청"
            value={aiPrompt}
            onChange={event => setAiPrompt(event.target.value)}
            fullWidth
            multiline
            minRows={3}
            disabled={aiBusy}
            inputProps={{ 'aria-label': 'AI 편집 요청' }}
          />
          {aiError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {aiError}
            </Alert>
          )}
          {draft && (
            <Stack spacing={1.5} mt={2}>
              <Alert severity="info">초안 미리보기입니다. 저장하기 전에는 적용되지 않습니다.</Alert>
              {aiModel && (
                <Typography variant="caption" color="text.secondary">
                  요청 모델: {aiModel}
                </Typography>
              )}
              <TextField label="제목" value={draft.title} InputProps={{ readOnly: true }} fullWidth />
              <TextField
                label="설명"
                value={draft.explanation}
                InputProps={{ readOnly: true }}
                fullWidth
                multiline
                minRows={3}
              />
              <TextField label="차트 제목" value={draft.chartTitle} InputProps={{ readOnly: true }} fullWidth />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setAiOpen(false);
              setDraft(null);
            }}
            disabled={aiBusy}
          >
            취소
          </Button>
          <Button onClick={requestAi} disabled={aiBusy || !aiPrompt.trim()} variant="outlined">
            {aiBusy && !draft ? '초안 생성 중…' : '초안 생성'}
          </Button>
          <Button onClick={saveDraft} disabled={aiBusy || !draft} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </PageTitleBox>
  );
}

export default Commerce;
