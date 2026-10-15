import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { post } from '@/helpers/apiHelper';
import type { DateRange, FilterValue, TrendGrain } from './PersonalSavedViews';
import { validDay, validTimeZone } from './PersonalSavedViews';
import { timeRangeLabel, validTimeRange } from './timeSelection';

export type TrendPointContribution = {
  column: string;
  grain: 'hour' | 'day' | 'week' | 'month';
  time: string;
  groupFingerprint: string;
};
export type ContributionRequest = {
  widgetIndex: number;
  expectedRevision: string;
  trendGrain: TrendGrain;
  category?: FilterValue;
  groupFingerprint?: string;
  trendPoint?: TrendPointContribution;
  period?: 'previous';
};
type ContributionData = Omit<ContributionRequest, 'trendGrain'> & {
  dateRange?: DateRange;
  title: string;
  components: string[];
  semantics: string;
};
type Props = {
  open: boolean;
  dashboardId: number;
  draft: unknown;
  filters: { column: string; values: FilterValue[] }[];
  dateRange?: DateRange | null;
  comparePrevious?: boolean;
  previousDateRange?: DateRange;
  sourceRevision?: string;
  disabledReason?: string;
  contribution?: ContributionRequest | null;
  widgetTitle?: string;
  onClose: () => void;
  onRefresh: () => void;
  onExited?: () => void;
};
type DetailData = {
  fields: { columnName: string; columnType: string }[];
  datas: Record<string, unknown>[];
  totalRows: string;
  page: number;
  pageSize: number;
  sourceRevision: string;
  columnCount?: number;
  scope?: string;
  contribution?: ContributionData;
  contributionComponents?: string[][];
};
const ownsCategory = (value: object) => Object.prototype.hasOwnProperty.call(value, 'category');
const ownsFingerprint = (value: object) => Object.prototype.hasOwnProperty.call(value, 'groupFingerprint');
const ownsTrendPoint = (value: object) => Object.prototype.hasOwnProperty.call(value, 'trendPoint');
const ownsPeriod = (value: object) => Object.prototype.hasOwnProperty.call(value, 'period');
const ownsDateRange = (value: object) => Object.prototype.hasOwnProperty.call(value, 'dateRange');
export function validContributionDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const range = value as DateRange;
  return (
    Object.keys(range).every(key => ['column', 'start', 'end', 'precision', 'timeZone'].includes(key)) &&
    (range.timeZone === undefined || validTimeZone(range.timeZone)) &&
    typeof range.column === 'string' &&
    !!range.column.trim() &&
    range.column.length <= 128 &&
    (Object.prototype.hasOwnProperty.call(range, 'precision')
      ? validTimeRange(range)
      : typeof range.start === 'string' &&
        typeof range.end === 'string' &&
        !range.start.startsWith('0000') &&
        !range.end.startsWith('0000') &&
        validDay(range.start) &&
        validDay(range.end) &&
        range.start <= range.end)
  );
}
export function sameContributionDateRange(a: unknown, b: unknown) {
  return (
    validContributionDateRange(a) &&
    validContributionDateRange(b) &&
    a.column === b.column &&
    a.start === b.start &&
    a.end === b.end &&
    a.precision === b.precision &&
    (a.timeZone ?? 'UTC') === (b.timeZone ?? 'UTC')
  );
}
export function validPreviousContributionRange(current: unknown, previous: unknown) {
  if (
    !validContributionDateRange(current) ||
    !validContributionDateRange(previous) ||
    current.column !== previous.column ||
    current.precision !== previous.precision ||
    (current.timeZone ?? 'UTC') !== (previous.timeZone ?? 'UTC')
  )
    return false;
  const timestamp = current.precision === 'timestamp';
  const instant = (value: string) => Date.parse(timestamp ? value : `${value}T00:00:00Z`);
  const start = instant(current.start);
  const day = 86400000;
  const duration = instant(current.end) - start + (timestamp ? 0 : day);
  return instant(previous.start) === start - duration && instant(previous.end) === start - (timestamp ? 0 : day);
}
const periodCaption = (range: DateRange) =>
  `${range.column}: ${
    range.precision === 'timestamp' ? timeRangeLabel(range) : `${range.start} ~ ${range.end} (${range.timeZone ?? 'UTC'})`
  }`;
export const validGroupFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function validTrendPointContribution(value: unknown): value is TrendPointContribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const point = value as TrendPointContribution;
  const instant = typeof point.time === 'string' ? Date.parse(point.time) : NaN;
  return (
    Object.keys(point).length === 4 &&
    Object.keys(point).every(key => ['column', 'grain', 'time', 'groupFingerprint'].includes(key)) &&
    typeof point.column === 'string' &&
    !!point.column.trim() &&
    point.column.length <= 128 &&
    ['hour', 'day', 'week', 'month'].includes(point.grain) &&
    validGroupFingerprint(point.groupFingerprint) &&
    typeof point.time === 'string' &&
    /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(point.time) &&
    Number.isFinite(instant) &&
    new Date(instant).toISOString().replace('.000Z', 'Z') === point.time
  );
}
const trendPointCaption = (point: TrendPointContribution) =>
  `추세 시점: ${point.column} · UTC ${point.time.replace('T', ' ').replace(/Z$/, '')} · ${
    { hour: '시간', day: '일', week: '주', month: '월' }[point.grain]
  } 집계`;
const primitiveCategory = (value: unknown) =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));
const categoryText = (value: FilterValue) =>
  value === null
    ? '값 없음 (NULL)'
    : `${String(value)} (${typeof value === 'number' ? '숫자' : typeof value === 'boolean' ? '불리언' : '문자열'})`;
const stringLabels = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(label => typeof label === 'string' && !!label.trim()) &&
  new Set(value).size === value.length;
function validContribution(data: DetailData, requested: ContributionRequest, title?: string, previousDateRange?: DateRange) {
  const response = data.contribution;
  return (
    !!response &&
    data.scope === 'widget aggregate input rows' &&
    response.widgetIndex === requested.widgetIndex &&
    response.expectedRevision === requested.expectedRevision &&
    ownsPeriod(response) === ownsPeriod(requested) &&
    (requested.period === 'previous'
      ? response.period === 'previous' &&
        ownsDateRange(response) &&
        sameContributionDateRange(response.dateRange, previousDateRange)
      : !ownsDateRange(response)) &&
    ownsTrendPoint(response) === ownsTrendPoint(requested) &&
    (!ownsTrendPoint(requested) ||
      (validTrendPointContribution(response.trendPoint) &&
        ['column', 'grain', 'time', 'groupFingerprint'].every(
          key => response.trendPoint[key] === requested.trendPoint[key],
        ))) &&
    ownsFingerprint(response) === ownsFingerprint(requested) &&
    (!ownsFingerprint(requested) ||
      (validGroupFingerprint(response.groupFingerprint) && response.groupFingerprint === requested.groupFingerprint)) &&
    ownsCategory(response) === ownsCategory(requested) &&
    (!ownsCategory(requested) ||
      (primitiveCategory(response.category) && Object.is(response.category, requested.category))) &&
    typeof response.title === 'string' &&
    !!response.title.trim() &&
    (!title || response.title === title) &&
    typeof response.semantics === 'string' &&
    !!response.semantics.trim() &&
    stringLabels(response.components) &&
    Array.isArray(data.contributionComponents) &&
    data.contributionComponents.length === data.datas.length &&
    data.contributionComponents.every(
      labels => stringLabels(labels) && labels.every(label => response.components.includes(label)),
    )
  );
}
export function canRequestNextPage(page: number, pageSize: number, totalRows: string) {
  return page < 10000 && BigInt(page + 1) * BigInt(pageSize) < BigInt(totalRows);
}
function errorText(error: unknown, contribution = false) {
  const e = error as { response?: { status?: number; data?: { data?: unknown; message?: unknown } }; message?: unknown };
  const body = e?.response?.data;
  const nested = body?.data as { message?: unknown };
  const message = [body?.data, nested?.message, body?.message, e?.message].find(
    value => typeof value === 'string' && value.trim(),
  );
  const stale = e?.response?.status === 409;
  return {
    stale,
    message: stale
      ? `${
          contribution ? '집계 정의 또는 원본 데이터 버전' : '원본 데이터 버전'
        }이 변경되었습니다. 대시보드 데이터를 새로 조회한 뒤 상세를 다시 열어 주세요.${
          typeof message === 'string' ? ` ${message}` : ''
        }`
      : typeof message === 'string'
      ? message
      : '원본 행을 조회하지 못했습니다. 다시 시도해 주세요.',
  };
}
const cellText = (value: unknown) =>
  value === null || value === undefined ? '값 없음' : typeof value === 'object' ? JSON.stringify(value) : String(value);

const cellClassName =
  'h-auto max-w-[240px] min-w-[100px] border-b border-border p-2 text-left font-normal whitespace-normal [overflow-wrap:anywhere]';

export default function SourceDetails({
  open,
  dashboardId,
  draft,
  filters,
  dateRange,
  comparePrevious = false,
  previousDateRange,
  sourceRevision,
  disabledReason = '',
  contribution,
  widgetTitle,
  onClose,
  onRefresh,
  onExited,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  // 닫힘 순서 계약: Radix의 onCloseAutoFocus는 unmount 후 setTimeout(0)으로 지연 실행되고
  // (@radix-ui/react-focus-scope/dist/index.mjs:107-118), Radix Dialog는 그 안에서
  // preventDefault 후 DialogTrigger에만 포커스를 준다(@radix-ui/react-dialog/dist/index.mjs:174-176).
  // 트리거가 없는 이 다이얼로그는 그 경로에서 포커스가 body로 떨어지므로, 실제 launcher 복원은
  // open→false 커밋에서 동기적으로 onExited(=DashboardAnalysis 복원 훅)에 위임한다.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) onExited?.();
    wasOpen.current = open;
  }, [open]);
  const contextKey = JSON.stringify({
    dashboardId,
    draft,
    filters,
    dateRange: dateRange ?? null,
    comparePrevious,
    previousDateRange,
    sourceRevision,
    contribution: contribution ?? null,
    widgetTitle,
  });
  const [pagination, setPagination] = useState({ contextKey, page: 0, pageSize: 25 });
  const page = pagination.contextKey === contextKey ? pagination.page : 0;
  const pageSize = pagination.pageSize;
  const [reload, setReload] = useState(0);
  const selectedWidget = (draft as { widgets?: { type?: string }[] })?.widgets?.[contribution?.widgetIndex];
  const invalidContribution =
    !!contribution &&
    (!Number.isInteger(contribution.widgetIndex) ||
      contribution.widgetIndex < 0 ||
      typeof contribution.expectedRevision !== 'string' ||
      !contribution.expectedRevision.trim() ||
      !['auto', 'day', 'week', 'month'].includes(contribution.trendGrain) ||
      (ownsFingerprint(contribution) && !validGroupFingerprint(contribution.groupFingerprint)) ||
      (ownsCategory(contribution) && !primitiveCategory(contribution.category)) ||
      ownsDateRange(contribution) ||
      (ownsPeriod(contribution) &&
        (contribution.period !== 'previous' ||
          !comparePrevious ||
          !validPreviousContributionRange(dateRange, previousDateRange) ||
          !(
            (selectedWidget?.type === 'BOARD_NUMERIC' && ownsTrendPoint(contribution)) ||
            (selectedWidget?.type === 'CHART_LINE' && ownsCategory(contribution))
          ))) ||
      (ownsTrendPoint(contribution) &&
        (!validTrendPointContribution(contribution.trendPoint) ||
          selectedWidget?.type !== 'BOARD_NUMERIC' ||
          ownsCategory(contribution) ||
          ownsFingerprint(contribution))));
  const blocked =
    disabledReason ||
    (invalidContribution ? '집계 조건을 확인한 뒤 원본 행을 조회할 수 있습니다.' : '') ||
    (!sourceRevision ? '데이터 버전을 확인한 뒤 원본 행을 조회할 수 있습니다.' : '');
  const requestKey = JSON.stringify({ contextKey, page, pageSize, reload, open, blocked });
  const [result, setResult] = useState<{ key: string; data?: DetailData; error?: ReturnType<typeof errorText> } | null>(
    null,
  );
  const serial = useRef(0);
  const currentKey = useRef(requestKey);
  currentKey.current = requestKey;
  useEffect(() => {
    serial.current += 1;
    const request = serial.current;
    const controller = new AbortController();
    setResult(null);
    if (open && !blocked) {
      post(
        '/ai/dashboard-details',
        {
          dashboardId,
          draft,
          filters,
          ...(dateRange ? { dateRange } : {}),
          ...(contribution?.period === 'previous' ? { comparePrevious: true } : {}),
          sourceRevision,
          page,
          pageSize,
          ...(contribution ? { contribution } : {}),
        },
        { timeout: 60000, signal: controller.signal },
      )
        .then(response => {
          if (controller.signal.aborted || request !== serial.current || currentKey.current !== requestKey) return;
          if (response?.data?.status !== 'SUCCESS') throw Object.assign(new Error('원본 행 조회 실패'), { response });
          const data = response.data.data as DetailData;
          if (
            !data ||
            (contribution
              ? data.scope !== 'widget aggregate input rows'
              : data.scope !== 'current common-filter source rows') ||
            (data.columnCount !== undefined &&
              (!Number.isInteger(data.columnCount) || data.columnCount < data.fields?.length)) ||
            !Array.isArray(data.fields) ||
            data.fields.length > 50 ||
            !data.fields.every(field => typeof field?.columnName === 'string' && typeof field.columnType === 'string') ||
            !Array.isArray(data.datas) ||
            data.datas.length > pageSize ||
            !data.datas.every(row => row && typeof row === 'object' && !Array.isArray(row)) ||
            typeof data.totalRows !== 'string' ||
            !/^\d+$/.test(data.totalRows) ||
            data.page !== page ||
            data.pageSize !== pageSize ||
            data.sourceRevision !== sourceRevision ||
            (contribution
              ? !validContribution(data, contribution, widgetTitle, previousDateRange)
              : data.contribution !== undefined || data.contributionComponents !== undefined)
          )
            throw new Error('원본 행 응답의 조건 또는 데이터 버전을 확인할 수 없습니다. 다시 조회해 주세요.');
          setResult({ key: requestKey, data });
        })
        .catch(error => {
          if (!controller.signal.aborted && request === serial.current && currentKey.current === requestKey)
            setResult({ key: requestKey, error: errorText(error, !!contribution) });
        });
    }
    return () => {
      controller.abort();
      serial.current += 1;
    };
    // The serialized key includes every request input; arrays may be recreated by the parent.
  }, [requestKey]);
  const visible = result?.key === requestKey ? result : null;
  const data = !blocked ? visible?.data : undefined;
  const error = !blocked ? visible?.error : undefined;
  const busy = !blocked && !visible;
  const canNext = !!data && canRequestNextPage(page, pageSize, data.totalRows);
  const changePage = (next: number) => setPagination({ contextKey, page: next, pageSize });
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        // Radix의 지연된 트리거 전용 복원(triggerRef.focus → null)과 FocusScope의 기본 복원
        // (previouslyFocusedElement ?? body)을 모두 막아, 위에서 동기 복원한 launcher 포커스를
        // 닫힘 순서 뒤에 덮어쓰지 않도록 한다.
        onCloseAutoFocus={event => {
          event.preventDefault();
        }}
        className="m-0 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[1200px] min-w-0 overflow-y-auto sm:max-w-[1200px]"
      >
        <DialogTitle id={titleId}>{contribution ? '집계에 사용된 원본 행' : '현재 공통 필터의 원본 행'}</DialogTitle>
        <div className="min-w-0">
          <DialogDescription id={descriptionId} className="mb-2 [overflow-wrap:anywhere]">
            {contribution
              ? `${
                  contribution.period === 'previous' ? '이전 기간' : '현재 적용 기간'
                }과 공통 필터, 해당 차트의 추가 조건을 적용한 집계 입력 행입니다.`
              : '현재 공통 필터와 적용 기간에 해당하는 원본 데이터입니다. 개별 차트에 설정한 추가 조건은 포함하지 않습니다.'}
          </DialogDescription>
          {contribution && (
            <p className="mb-2 text-sm [overflow-wrap:anywhere]">
              차트: {widgetTitle || data?.contribution?.title || '선택한 집계'} ·{' '}
              {contribution.trendPoint && validTrendPointContribution(contribution.trendPoint)
                ? trendPointCaption(contribution.trendPoint)
                : ownsCategory(contribution)
                ? `그룹: ${categoryText(contribution.category)}`
                : '위젯 전체'}
            </p>
          )}
          {contribution?.period === 'previous' && validContributionDateRange(previousDateRange) && (
            <p className="mb-2 text-sm [overflow-wrap:anywhere]">이전 기간: {periodCaption(previousDateRange)}</p>
          )}
          <p className="mb-2 text-sm [overflow-wrap:anywhere]">
            {contribution?.period === 'previous' ? '현재 비교 기준: ' : ''}
            {dateRange
              ? `${dateRange.column}: ${
                  dateRange.precision === 'timestamp'
                    ? timeRangeLabel(dateRange)
                    : `${dateRange.start} ~ ${dateRange.end} (${dateRange.timeZone ?? 'UTC'})`
                }`
              : '전체 기간'}{' '}
            ·{' '}
            {filters.length
              ? filters.map(filter => `${filter.column}: ${filter.values.map(cellText).join(', ')}`).join(' · ')
              : '필터 없음'}
          </p>
          {sourceRevision && <p className="text-xs">데이터 버전: {sourceRevision.slice(0, 12)}</p>}
          {blocked && <Notice severity="info">{blocked} 이전 원본 행은 표시하지 않습니다.</Notice>}
          <p role="status" aria-live="polite" aria-atomic="true" className="my-2">
            {busy
              ? `원본 행 조회 중 · ${page + 1}페이지 · 페이지당 ${pageSize}행`
              : data
              ? `총 ${data.totalRows}행 · ${page + 1}페이지 · 현재 ${data.datas.length}행`
              : ''}
          </p>
          {busy && <Skeleton role="progressbar" aria-label="원본 행 조회 중" aria-busy="true" className="my-2 h-1 w-full" />}
          {error && (
            <Notice severity="error">
              {error.message}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={
                  error.stale
                    ? onRefresh
                    : event => {
                        // Keep keyboard focus inside the dialog before the retry button is removed.
                        if (document.activeElement === event.currentTarget) closeButton.current?.focus();
                        setReload(value => value + 1);
                      }
                }
              >
                {error.stale ? '대시보드 데이터 새로 조회' : '원본 행 다시 조회'}
              </Button>
            </Notice>
          )}
          {data && (
            <>
              {data.contribution && <p className="mb-2 text-sm [overflow-wrap:anywhere]">{data.contribution.semantics}</p>}
              {data.columnCount !== undefined && data.columnCount > 50 && (
                <Notice severity="info">원본 {data.columnCount}개 컬럼 중 처음 50개 컬럼만 표시합니다.</Notice>
              )}
              {page >= 10000 && BigInt(page + 1) * BigInt(pageSize) < BigInt(data.totalRows) && (
                <Notice severity="info">조회 한도에 도달했습니다. 필터로 범위를 좁혀 주세요.</Notice>
              )}
              <div
                role="region"
                aria-label={contribution ? '집계에 사용된 원본 행 표' : '현재 공통 필터의 원본 행 표'}
                tabIndex={0}
                className="max-h-[50dvh] max-w-full overflow-auto rounded border border-border"
              >
                <Table className="min-w-full border-collapse">
                  <TableCaption className="caption-top text-left">
                    {contribution ? '집계에 사용된 원본 데이터' : '현재 공통 필터의 원본 데이터'} · {page + 1}페이지
                  </TableCaption>
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:bg-background">
                    <TableRow>
                      {contribution && (
                        <TableHead scope="col" className={`${cellClassName} min-w-[128px]`}>
                          집계 구성요소
                        </TableHead>
                      )}
                      {data.fields.map(field => (
                        <TableHead scope="col" key={field.columnName} className={cellClassName}>
                          {field.columnName}
                          <span className="block text-xs">{field.columnType}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.datas.map((row, index) => (
                      <TableRow key={index}>
                        {contribution && (
                          <TableCell className={`${cellClassName} min-w-[128px]`}>
                            {data.contributionComponents[index].map(label => (
                              <span
                                key={label}
                                className="mr-1 mb-1 box-border inline-block max-w-full rounded border border-border px-1.5 py-0.5 text-xs whitespace-normal [overflow-wrap:anywhere]"
                              >
                                {label}
                              </span>
                            ))}
                          </TableCell>
                        )}
                        {data.fields.map(field => (
                          <TableCell key={field.columnName} className={cellClassName}>
                            {cellText(
                              Object.prototype.hasOwnProperty.call(row, field.columnName)
                                ? row[field.columnName]
                                : undefined,
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!data.datas.length && <p className="mt-2">현재 조건에 해당하는 원본 행이 없습니다.</p>}
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex max-w-full shrink-0 flex-col gap-1.5">
              <Label htmlFor="source-details-page-size">페이지당 행 수</Label>
              <Select
                value={String(pageSize)}
                disabled={busy || !!blocked || !!error}
                onValueChange={value => setPagination({ contextKey, page: 0, pageSize: Number(value) })}
              >
                <SelectTrigger id="source-details-page-size" size="sm" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map(size => (
                    <SelectItem key={size} value={String(size)}>
                      {size}행
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" disabled={busy || !data || page === 0} onClick={() => changePage(page - 1)}>
              이전 페이지
            </Button>
            <Button variant="ghost" disabled={busy || !canNext} onClick={() => changePage(page + 1)}>
              다음 페이지
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button ref={closeButton} variant="ghost" className="min-h-11" onClick={onClose}>
            원본 상세 닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
