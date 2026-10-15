import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';
import { AnalysisUiProvider, analysisFieldClassName } from '@/components/analysis/AnalysisUi';
import AiDashboardPanel from '@/pages/Dashboard/Components/AiDashboardPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField } from '@/components/ui/text-field';
import { get, post, postForm, put } from '@/helpers/apiHelper';
import { cn } from '@/lib/utils';
import type { CommercePresentation, CommerceProject, CommerceReport } from './types';
import ImportHelp, { parseImportDiagnostic } from './ImportHelp';

/** Compact control geometry shared by the commerce header, scope and dialog actions. */
const CONTROL_CLASS = 'h-8 whitespace-nowrap';
const CARD_CLASS = 'min-w-0 rounded-xl border border-[#dce5ee] ring-0';
const BLUE = '#0f5ab2';
const CURRENCY = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const AXIS_CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
// Fixed, non-customer guidance. Required header names mirror the server bundle contract in
// backend-api/src/analysis/commerce-import.ts; the date columns accept ISO 8601 UTC values.
const requiredFileHeaders: Record<string, string[]> = {
  orders: [
    'order_id',
    'customer_id',
    'ordered_at',
    'order_status',
    'currency',
    'subtotal',
    'tax_amount',
    'shipping_amount',
    'order_total',
  ],
  payments: ['payment_id', 'order_id', 'paid_at', 'payment_status', 'amount'],
  refunds: ['refund_id', 'payment_id', 'order_id', 'refunded_at', 'refund_reason', 'amount'],
  customers: ['customer_id', 'acquisition_channel'],
};
const DATE_COLUMN_EXAMPLE = '2024-01-31T00:00:00Z';
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
  const [searchParams] = useSearchParams();
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
  const [importOpen, setImportOpen] = useState(!routeProjectId || searchParams.get('import') === '1');
  const [reselectTick, setReselectTick] = useState(0);
  const [importTargetId, setImportTargetId] = useState(routeProjectId ?? '');
  const [pageError, setPageError] = useState('');
  const [importFailure, setImportFailure] = useState<{
    message: string;
    diagnostic: ReturnType<typeof parseImportDiagnostic>;
  } | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [dateErrors, setDateErrors] = useState({ start: '', end: '' });
  /** Native date inputs are read through their DOM id: the date fields carry the id themselves. */
  const dateInput = (id: string) => document.getElementById(id) as HTMLInputElement | null;
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
  const uploadRequest = useRef(0);
  const pendingReselect = useRef(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Abandon any in-flight import so a late resolution or rejection cannot restore stale error state.
  const abandonUpload = useCallback(() => {
    uploadRequest.current += 1;
    setUploadBusy(false);
  }, []);

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
    abandonUpload();
  }, [routeProjectId, abandonUpload]);
  useEffect(
    () => () => {
      uploadRequest.current += 1;
    },
    [],
  );

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
    setImportFailure(null);
    abandonUpload();
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
    uploadRequest.current += 1;
    const requestId = uploadRequest.current;
    setUploadBusy(true);
    setPageError('');
    setImportFeedback('');
    setImportFailure(null);
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
      if (requestId !== uploadRequest.current) return;
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
      if (requestId !== uploadRequest.current) return;
      if (id != null) {
        setSelectedId(String(id));
        navigate(`/commerce/${id}`);
        await fetchReport(String(id));
      } else {
        setPageError('가져오기는 완료했지만 응답에 projectId가 없습니다. 프로젝트 목록에서 새 프로젝트를 선택해 주세요.');
      }
    } catch (error) {
      if (requestId !== uploadRequest.current) return;
      const diagnostic = parseImportDiagnostic(error);
      const detail =
        diagnostic?.errorCode === 'IMPORT_INVALID_DATE'
          ? `날짜 값 형식을 확인해 주세요. 권장 예시: ${DATE_COLUMN_EXAMPLE} (UTC).`
          : diagnostic?.errorCode === 'IMPORT_MISSING_COLUMNS'
          ? '주문·결제·환불 파일에 필수 열이 있는지 확인해 주세요.'
          : '파일 형식과 필수 열·날짜 값을 확인해 주세요.';
      const message = `CSV 가져오기에 실패했습니다. ${detail}${
        report ? ` 이전 리포트(${reportScope})는 유지했습니다.` : ''
      }`;
      setPageError(message);
      setImportFailure({ message, diagnostic });
    } finally {
      if (requestId === uploadRequest.current) setUploadBusy(false);
    }
  };

  const applyFilters = () => {
    if (reportBusy) return;
    const startInput = dateInput('commerce-start-date');
    const endInput = dateInput('commerce-end-date');
    const incompleteStart = Boolean(startInput?.validity.badInput);
    const incompleteEnd = Boolean(endInput?.validity.badInput);
    if (incompleteStart || incompleteEnd) {
      const message = '연·월·일을 모두 입력하거나 날짜를 완전히 지워 주세요.';
      setDateErrors({ start: incompleteStart ? message : '', end: incompleteEnd ? message : '' });
      (incompleteStart ? startInput : endInput)?.focus();
      return;
    }
    if (Boolean(start) !== Boolean(end)) {
      const message = '시작일과 종료일을 모두 입력하거나 모두 비워 주세요.';
      setDateErrors({ start: start ? '' : message, end: end ? '' : message });
      (start ? endInput : startInput)?.focus();
      return;
    }
    if (
      start &&
      end &&
      (Number.isNaN(Date.parse(`${start}T00:00:00Z`)) || Number.isNaN(Date.parse(`${end}T00:00:00Z`)) || start > end)
    ) {
      const message = '올바른 UTC 날짜 범위를 입력해 주세요.';
      setDateErrors({ start: message, end: message });
      startInput?.focus();
      return;
    }
    setDateErrors({ start: '', end: '' });
    if (selectedId) fetchReport(selectedId, { start, end, channel });
  };
  const resetFilters = () => {
    if (reportBusy) return;
    // Native date inputs can retain incomplete segments while their value is already ''.
    const startInput = dateInput('commerce-start-date');
    const endInput = dateInput('commerce-end-date');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    setDateErrors({ start: '', end: '' });
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
  const reselectImportFiles = () => {
    const input = fileInputRefs.current.orders;
    if (importOpen && input) {
      input.click();
      return;
    }
    // The card can be collapsed, so the file input is not mounted yet. Open it and click after render.
    pendingReselect.current = true;
    setImportOpen(true);
    setReselectTick(value => value + 1);
  };

  useEffect(() => {
    if (!pendingReselect.current) return;
    pendingReselect.current = false;
    fileInputRefs.current.orders?.click();
  }, [importOpen, reselectTick]);
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
  const [analysisAiOpen, setAnalysisAiOpen] = useState(false);
  const presentationTitle = presentation.title || heading;
  const importDiagnostic = importFailure && importFailure.message === pageError ? importFailure.diagnostic : null;

  return (
    <PageTitleBox title="매출·환불" upperTitle="데이터" upperTitleLink="/data" className="w-full box-border px-4 sm:px-6">
      <Seo title="매출·환불 MVP" />
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-[18px] py-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold wrap-anywhere text-[#17324d]">{presentationTitle}</h1>
            <p className="text-sm text-muted-foreground">결제 이벤트 기준 매출 · 환불 이벤트 기준 환불</p>
          </div>
          <div className="flex w-full flex-col items-start gap-2 sm:flex-row md:w-auto">
            <TextField
              select
              label="프로젝트"
              value={selectedId}
              onChange={event => chooseProject(event.target.value)}
              className={cn(analysisFieldClassName, 'w-full sm:w-[240px]')}
            >
              <option value="">프로젝트 선택</option>
              {projects.map(project => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </TextField>
            <div className="flex flex-wrap gap-2">
              {report && (
                <Button variant="outline" onClick={openAi} className="whitespace-nowrap">
                  <Sparkles aria-hidden="true" className="size-4" />
                  AI로 설명·제목 편집
                </Button>
              )}
              <Button onClick={() => setAnalysisAiOpen(true)} className="whitespace-nowrap">
                <Sparkles aria-hidden="true" className="size-4" />
                AI 분석 만들기
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          이 보고서는 설명·제목을 편집합니다. AI 분석 만들기에서는 파일 분석 소스를 선택하고 질문으로 지표·차트를 구성합니다.
        </p>

        {searchParams.get('sample') === '1' && (
          <Notice severity="info">
            <p className="text-sm">
              Analytics Engineering의 공개 합성 데이터 일부입니다(CC BY 4.0). 실제 고객 매출이 아닙니다. USD·UTC 기준,
              세금·배송을 포함한 결제액에서 환불액을 뺀 차감수취액이며 상품 순매출·이익이 아닙니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="link">
                <a href="https://www.analyticsengineering.com/datasets/ecommerce-sales" target="_blank" rel="noreferrer">
                  데이터 출처
                </a>
              </Button>
              <Button variant="ghost" onClick={() => navigate('/commerce?import=1')}>
                내 매출·환불 파일 연결
              </Button>
            </div>
          </Notice>
        )}
        {pageError && (
          <Notice severity="error" className="wrap-anywhere">
            <span className="break-words">{pageError}</span>
            <p className="mt-1 text-sm">
              프로젝트 접근 권한, 필수 CSV와 날짜·금액 형식을 확인해 주세요. 실패한 가져오기는 마지막 정상 보고서를 교체하지
              않습니다.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={loadProjects}>
                프로젝트 목록 다시 불러오기
              </Button>
              <Button variant="ghost" onClick={() => setPageError('')}>
                닫기
              </Button>
              {importFailure && !importDiagnostic && (
                <Button variant="ghost" onClick={reselectImportFiles}>
                  파일 다시 선택
                </Button>
              )}
            </div>
            {importDiagnostic && (
              <ImportHelp
                key={importDiagnostic.requestId}
                diagnostic={importDiagnostic}
                onReselectFiles={reselectImportFiles}
              />
            )}
          </Notice>
        )}
        {importFeedback && (
          <Notice severity="success" className="wrap-anywhere">
            <span className="break-words">{importFeedback}</span>
            <Button variant="ghost" onClick={() => setImportFeedback('')}>
              닫기
            </Button>
          </Notice>
        )}
        {projectsBusy && (
          <div className="flex items-center gap-2">
            <Loader2 aria-hidden="true" className="size-[18px] animate-spin" />
            <p>프로젝트를 불러오는 중…</p>
          </div>
        )}

        {report && (
          <Button
            variant="outline"
            onClick={() => setImportOpen(value => !value)}
            aria-expanded={importOpen}
            className="self-start"
          >
            {importOpen ? '데이터 가져오기 닫기' : '데이터 가져오기 / 교체'}
          </Button>
        )}

        {importOpen && (
          <Card className={CARD_CLASS}>
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">주문·결제·환불 데이터 가져오기</h2>
              <p className="text-sm text-muted-foreground">
                CSV 파일을 서버 DuckDB 워커로 가져옵니다. 실패하면 기존 프로젝트 리포트는 유지됩니다. 각 파일에는 카드에
                표시된 필수 헤더가 필요합니다. 날짜 열(ordered_at·paid_at·refunded_at)은 UTC 타임스탬프 형식을 권장하며, 권장
                예시는 {DATE_COLUMN_EXAMPLE}입니다.
              </p>
              <div className="flex flex-col gap-3">
                <TextField
                  select
                  label="가져올 대상"
                  value={importTargetId}
                  onChange={event => {
                    setImportTargetId(event.target.value);
                    setImportFailure(null);
                    abandonUpload();
                  }}
                  className="w-full"
                >
                  <option value="">새 프로젝트</option>
                  {projects.map(project => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}에 교체 가져오기
                    </option>
                  ))}
                </TextField>
                <TextField
                  label="프로젝트 이름"
                  value={projectName}
                  onChange={event => setProjectName(event.target.value)}
                  className="w-full"
                  inputProps={{ 'aria-label': '프로젝트 이름' }}
                  helperText={
                    importTargetId ? '비워 두면 선택한 프로젝트 이름을 사용합니다.' : '새 프로젝트에 표시할 이름입니다.'
                  }
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {Object.entries(fileLabel).map(([key, label]) => {
                    const preview = previews[key];
                    return (
                      <Card key={key} className={cn(CARD_CLASS, 'rounded-lg')}>
                        <CardContent className="flex flex-col gap-2">
                          <p className="font-semibold">
                            {label}
                            {key !== 'customers' && <span className="text-destructive"> *</span>}
                          </p>
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
                            variant="outline"
                            onClick={() => fileInputRefs.current[key]?.click()}
                            aria-label={`${label} 선택`}
                            className="w-full justify-start text-left wrap-anywhere whitespace-normal"
                          >
                            <Upload aria-hidden="true" className="size-4 shrink-0" />
                            {files[key]?.name || `${label} 선택`}
                          </Button>
                          <p className="text-xs wrap-anywhere text-muted-foreground">
                            필수 헤더: {requiredFileHeaders[key].join(' · ')}
                          </p>
                          {preview && (
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                헤더 {preview.headers.length}개 · 미리보기 {preview.samples.length}행
                                {' · 전체 행 수는 서버 검증 후 표시'}
                              </p>
                              <p className="text-xs wrap-anywhere text-[#34516c]">
                                열: {preview.headers.join(' · ') || '헤더 없음'}
                              </p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-xs text-[#0f5ab2]">표본 행 내용 보기</summary>
                                <pre className="mt-1 mb-0 max-h-[120px] overflow-auto rounded-lg bg-[#f5f8fb] p-1.5 text-xs wrap-anywhere whitespace-pre-wrap">
                                  {preview.samples
                                    .map(sample => sample.map(value => value.slice(0, 80)).join(' | '))
                                    .join('\n') || '헤더 외 표본 행 없음'}
                                </pre>
                              </details>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Button onClick={upload} disabled={uploadBusy} className="self-start">
                  {uploadBusy ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      가져오는 중…
                    </>
                  ) : (
                    <>
                      <Upload aria-hidden="true" className="size-4" />
                      CSV 가져오기
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && !routeProjectId && !report && (
          <div className="flex flex-col gap-2">
            <p className="text-base font-bold">내 프로젝트</p>
            {projects.map(project => (
              <Button
                key={project.id}
                variant="ghost"
                onClick={() => chooseProject(project.id)}
                className="h-auto w-full justify-start text-left wrap-anywhere whitespace-normal"
              >
                {project.name}
              </Button>
            ))}
          </div>
        )}

        {report && (
          <>
            <Card className={cn(CARD_CLASS, 'border-[#d9e6f4] bg-[#f8fbff]')}>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm font-bold">조회 범위</p>
                <div className="flex flex-wrap items-start gap-2">
                  <TextField
                    id="commerce-start-date"
                    type="date"
                    label="시작일 (UTC)"
                    value={start}
                    onChange={event => {
                      setStart(event.target.value);
                      setDateErrors({ start: '', end: '' });
                    }}
                    error={Boolean(dateErrors.start)}
                    helperText={dateErrors.start || undefined}
                    className={cn(analysisFieldClassName, 'w-full sm:w-[154px]')}
                    inputProps={{ 'aria-label': '시작일 UTC' }}
                  />
                  <TextField
                    id="commerce-end-date"
                    type="date"
                    label="종료일 (UTC)"
                    value={end}
                    onChange={event => {
                      setEnd(event.target.value);
                      setDateErrors({ start: '', end: '' });
                    }}
                    error={Boolean(dateErrors.end)}
                    helperText={dateErrors.end || undefined}
                    className={cn(analysisFieldClassName, 'w-full sm:w-[154px]')}
                    inputProps={{ 'aria-label': '종료일 UTC' }}
                  />
                  <TextField
                    select
                    label="채널"
                    value={channel}
                    onChange={event => setChannel(event.target.value)}
                    className={cn(analysisFieldClassName, 'w-full sm:w-[190px]')}
                  >
                    <option value="">전체 채널</option>
                    {report.availableChannels.map(item => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </TextField>
                  <div className="flex gap-2">
                    <Button
                      onClick={applyFilters}
                      aria-disabled={reportBusy}
                      className={cn(CONTROL_CLASS, reportBusy && 'opacity-50')}
                    >
                      적용
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetFilters}
                      aria-disabled={reportBusy}
                      className={cn(CONTROL_CLASS, reportBusy && 'opacity-50')}
                    >
                      초기화
                    </Button>
                  </div>
                </div>
                <p role="status" aria-atomic="true" className="text-xs text-muted-foreground">
                  표시 결과 범위: {reportScope || '불러오는 중'}
                  {reportBusy ? ' · 새 범위를 조회 중…' : ''}
                </p>
              </CardContent>
            </Card>

            <Notice severity="info">
              <p className="text-sm">
                <b>매출 정의:</b> 결제 성공 이벤트 금액 · <b>환불:</b> 환불 이벤트가 처리된 날의 금액 · <b>차감 수취액:</b>{' '}
                결제액 − 환불액(USD, 세금·배송 포함)입니다.
              </p>
              <p className="mt-1 text-sm">
                주문 수·환불 주문 비율은 주문일 기준 코호트의 확보한 데이터 전체 기간 내 환불 이력이며, 환불액의 추이와 날짜
                기준이 다릅니다. 차감 수취액은 상품 순매출이 아닙니다.
              </p>
            </Notice>
            {presentation.explanation && <Notice severity="info">{presentation.explanation}</Notice>}

            {reportBusy && (
              <div className="flex items-center gap-2">
                <Loader2 aria-hidden="true" className="size-[18px] animate-spin" />
                <p>리포트를 불러오는 중…</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-6">
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
                <Card key={label} className={CARD_CLASS}>
                  <CardContent className="flex flex-col gap-1 p-3 sm:p-4">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-base font-bold wrap-anywhere text-[#0f5ab2] sm:text-xl">{value}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
              <Card className={CARD_CLASS}>
                <CardContent className="min-w-0">
                  <h2 className="text-lg font-bold">{presentation.chartTitle || '매출·환불 추이'}</h2>
                  <p className="text-xs text-muted-foreground">결제 및 환불 이벤트 날짜별 금액 · USD</p>
                  {report.daily.length ? (
                    <ReactECharts
                      option={dailyOption}
                      notMerge
                      style={{ width: '100%', height: 310, maxWidth: '100%' }}
                      aria-label="일별 결제액, 환불액, 차감 수취액 추이"
                    />
                  ) : (
                    <p className="py-12 text-center text-muted-foreground">표시할 일별 데이터가 없습니다.</p>
                  )}
                  {report.daily.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-[#0f5ab2]">일별 정확한 수치 표 보기</summary>
                      <div
                        role="region"
                        aria-label="일별 매출·환불 수치 표 스크롤"
                        tabIndex={0}
                        className="mt-2 max-h-[320px] overflow-auto"
                      >
                        <Table aria-label="일별 매출·환불 수치 (USD)" className="min-w-[500px]">
                          <TableHeader>
                            <TableRow>
                              {['날짜 (UTC)', '결제액', '환불액', '차감 수취액'].map(label => (
                                <TableHead key={label} scope="col" className="sticky top-0 bg-[#f5f8fb] p-1.5 text-left">
                                  {label}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.daily.map(item => (
                              <TableRow key={item.date}>
                                {[
                                  item.date,
                                  formatMoney(item.paymentTotal),
                                  formatMoney(item.refundTotal),
                                  formatMoney(item.netCollected),
                                ].map((value, index) => (
                                  <TableCell key={index} className="border-t border-[#edf0f4] p-1.5 whitespace-nowrap">
                                    {value}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
              <Card className={CARD_CLASS}>
                <CardContent className="min-w-0">
                  <h2 className="text-lg font-bold">채널별 차감 수취액</h2>
                  <p className="text-xs text-muted-foreground">내림차순 · USD</p>
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
                    <p className="py-12 text-center text-muted-foreground">표시할 채널 데이터가 없습니다.</p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-[#0f5ab2]">채널별 정확한 수치 표 보기</summary>
                    <div role="region" aria-label="채널별 수치 표 스크롤" tabIndex={0} className="mt-2 overflow-x-auto">
                      <Table aria-label="채널별 매출·환불 수치 (USD)">
                        <TableHeader>
                          <TableRow>
                            {['채널', '결제액', '환불액', '차감 수취액'].map(label => (
                              <TableHead key={label} scope="col" className="p-1.5 text-right">
                                {label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...report.channels]
                            .sort((a, b) => (numberValue(b.netCollected) ?? 0) - (numberValue(a.netCollected) ?? 0))
                            .map(item => (
                              <TableRow key={item.channel}>
                                {[
                                  item.channel,
                                  formatMoney(item.paymentTotal),
                                  formatMoney(item.refundTotal),
                                  formatMoney(item.netCollected),
                                ].map((value, i) => (
                                  <TableCell
                                    key={i}
                                    className={cn(
                                      'border-t border-[#edf0f4] p-1.5 wrap-anywhere',
                                      i ? 'text-right' : 'text-left',
                                    )}
                                  >
                                    {value}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,.7fr)_minmax(0,1.3fr)]">
              <Card className={CARD_CLASS}>
                <CardContent>
                  <h2 className="mb-2 text-lg font-bold">환불 사유</h2>
                  {report.reasons.length ? (
                    report.reasons.map(item => (
                      <div key={item.reason} className="flex justify-between gap-2 border-b border-[#edf0f4] py-2">
                        <p className="wrap-anywhere">{item.reason}</p>
                        <p className="text-right font-semibold">
                          {formatMoney(item.refundTotal)}{' '}
                          <span className="text-xs text-muted-foreground">({Number(item.refunds).toLocaleString()}건)</span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">환불 내역이 없습니다.</p>
                  )}
                </CardContent>
              </Card>
              <Card className={CARD_CLASS}>
                <CardContent className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold">최근 주문</h2>
                      <p className="text-xs text-muted-foreground">최신 100건까지 제공</p>
                    </div>
                    {report.orders.length > 12 && (
                      <Button
                        variant="ghost"
                        onClick={() => setShowAllOrders(value => !value)}
                        aria-expanded={showAllOrders}
                        aria-controls="commerce-orders-table"
                        className="shrink-0"
                      >
                        {showAllOrders ? '접기' : `전체 ${report.orders.length}건`}
                      </Button>
                    )}
                  </div>
                  {report.orders.length ? (
                    <div role="region" aria-label="최근 주문 표 스크롤" tabIndex={0} className="max-w-full overflow-x-auto">
                      <Table id="commerce-orders-table" aria-label="최근 주문 (금액 USD)" className="min-w-[680px]">
                        <TableHeader>
                          <TableRow>
                            {['주문 ID', '주문일', '채널', '상태', '결제액', '환불액', '차감 수취액'].map(label => (
                              <TableHead key={label} scope="col" className="bg-[#f5f8fb] p-2 text-left whitespace-nowrap">
                                {label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {latestOrders.map((item, index) => (
                            <TableRow key={`${item.orderId}-${index}`}>
                              {[
                                item.orderId,
                                item.orderedAt,
                                item.channel,
                                item.orderStatus,
                                formatMoney(item.paidAmount),
                                formatMoney(item.refundAmount),
                                formatMoney(item.netCollected),
                              ].map((value, i) => (
                                <TableCell
                                  key={i}
                                  className={cn(
                                    'border-t border-[#edf0f4] p-2',
                                    i < 4 ? 'wrap-anywhere whitespace-normal' : 'whitespace-nowrap',
                                  )}
                                >
                                  {value}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">표시할 주문이 없습니다.</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <Separator />
            {report.project && (
              <p className="text-xs text-muted-foreground">
                프로젝트: {report.project.name} · 리포트 데이터는 서버에서 계산했습니다. 검증 샘플 출처:{' '}
                <a href="https://www.analyticsengineering.com/datasets/ecommerce-sales" target="_blank" rel="noreferrer">
                  Analytics Engineering Ecommerce Sales &amp; Returns
                </a>{' '}
                (합성 데이터, CC BY 4.0). 업로드 데이터의 출처는 별도로 확인해 주세요.
              </p>
            )}
          </>
        )}
      </div>

      <Dialog
        open={aiOpen}
        onOpenChange={next => {
          if (!next && !aiBusy) {
            setAiOpen(false);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>AI로 설명·제목 편집</DialogTitle>
            <DialogDescription>
              현재 리포트 표현의 제목·설명만 제안합니다. 매출·환불 계산 기준은 변경하지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <TextField
            autoFocus
            label="편집 요청"
            value={aiPrompt}
            onChange={event => setAiPrompt(event.target.value)}
            multiline
            minRows={3}
            disabled={aiBusy}
            inputProps={{ 'aria-label': 'AI 편집 요청' }}
            className="w-full"
          />
          {aiError && (
            <Notice severity="error" className="mt-2">
              {aiError}
            </Notice>
          )}
          {draft && (
            <div className="mt-2 flex flex-col gap-3">
              <Notice severity="info">초안 미리보기입니다. 저장하기 전에는 적용되지 않습니다.</Notice>
              {aiModel && <p className="text-xs text-muted-foreground">요청 모델: {aiModel}</p>}
              <TextField label="제목" value={draft.title} readOnly className="w-full" />
              <TextField label="설명" value={draft.explanation} readOnly multiline minRows={3} className="w-full" />
              <TextField label="차트 제목" value={draft.chartTitle} readOnly className="w-full" />
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAiOpen(false);
                setDraft(null);
              }}
              disabled={aiBusy}
            >
              취소
            </Button>
            <Button variant="outline" onClick={requestAi} disabled={aiBusy || !aiPrompt.trim()}>
              {aiBusy && !draft ? '초안 생성 중…' : '초안 생성'}
            </Button>
            <Button onClick={saveDraft} disabled={aiBusy || !draft}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AiDashboardPanel
        open={analysisAiOpen}
        onClose={() => setAnalysisAiOpen(false)}
        onSaved={id => {
          setAnalysisAiOpen(false);
          navigate(`/dashboard/${id}`);
        }}
      />
    </PageTitleBox>
  );
}

export default function CommercePage() {
  return (
    <AnalysisUiProvider>
      <Commerce />
    </AnalysisUiProvider>
  );
}
