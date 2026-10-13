import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      TransitionProps={{ onExited }}
      PaperProps={{ sx: { m: 2, width: 'calc(100% - 32px)', maxHeight: 'calc(100dvh - 32px)', minWidth: 0 } }}
    >
      <DialogTitle id={titleId}>{contribution ? '집계에 사용된 원본 행' : '현재 공통 필터의 원본 행'}</DialogTitle>
      <DialogContent sx={{ minWidth: 0 }}>
        <Typography id={descriptionId} variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
          {contribution
            ? `${
                contribution.period === 'previous' ? '이전 기간' : '현재 적용 기간'
              }과 공통 필터, 해당 차트의 추가 조건을 적용한 집계 입력 행입니다.`
            : '현재 공통 필터와 적용 기간에 해당하는 원본 데이터입니다. 개별 차트에 설정한 추가 조건은 포함하지 않습니다.'}
        </Typography>
        {contribution && (
          <Typography variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
            차트: {widgetTitle || data?.contribution?.title || '선택한 집계'} ·{' '}
            {contribution.trendPoint && validTrendPointContribution(contribution.trendPoint)
              ? trendPointCaption(contribution.trendPoint)
              : ownsCategory(contribution)
              ? `그룹: ${categoryText(contribution.category)}`
              : '위젯 전체'}
          </Typography>
        )}
        {contribution?.period === 'previous' && validContributionDateRange(previousDateRange) && (
          <Typography variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
            이전 기간: {periodCaption(previousDateRange)}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
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
        </Typography>
        {sourceRevision && <Typography variant="caption">데이터 버전: {sourceRevision.slice(0, 12)}</Typography>}
        {blocked && <Alert severity="info">{blocked} 이전 원본 행은 표시하지 않습니다.</Alert>}
        <Typography role="status" aria-live="polite" aria-atomic="true" sx={{ my: 1 }}>
          {busy
            ? `원본 행 조회 중 · ${page + 1}페이지 · 페이지당 ${pageSize}행`
            : data
            ? `총 ${data.totalRows}행 · ${page + 1}페이지 · 현재 ${data.datas.length}행`
            : ''}
        </Typography>
        {busy && <LinearProgress aria-label="원본 행 조회 중" sx={{ my: 1 }} />}
        {error && (
          <Alert severity="error">
            {error.message}
            <Button
              onClick={
                error.stale
                  ? onRefresh
                  : event => {
                      // Keep keyboard focus inside the paper before the retry button is removed.
                      if (document.activeElement === event.currentTarget) closeButton.current?.focus();
                      setReload(value => value + 1);
                    }
              }
            >
              {error.stale ? '대시보드 데이터 새로 조회' : '원본 행 다시 조회'}
            </Button>
          </Alert>
        )}
        {data && (
          <>
            {data.contribution && (
              <Typography variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                {data.contribution.semantics}
              </Typography>
            )}
            {data.columnCount !== undefined && data.columnCount > 50 && (
              <Alert severity="info">원본 {data.columnCount}개 컬럼 중 처음 50개 컬럼만 표시합니다.</Alert>
            )}
            {page >= 10000 && BigInt(page + 1) * BigInt(pageSize) < BigInt(data.totalRows) && (
              <Alert severity="info">조회 한도에 도달했습니다. 필터로 범위를 좁혀 주세요.</Alert>
            )}
            <Box
              role="region"
              aria-label={contribution ? '집계에 사용된 원본 행 표' : '현재 공통 필터의 원본 행 표'}
              tabIndex={0}
              sx={{
                maxHeight: '50dvh',
                maxWidth: '100%',
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                '& table': { borderCollapse: 'collapse', minWidth: '100%' },
                '& th, & td': {
                  textAlign: 'left',
                  p: 1,
                  minWidth: 100,
                  maxWidth: 240,
                  overflowWrap: 'anywhere',
                  borderBottom: 1,
                  borderColor: 'divider',
                },
                '& thead th': { position: 'sticky', top: 0, backgroundColor: 'background.paper' },
              }}
            >
              <table>
                <caption>
                  {contribution ? '집계에 사용된 원본 데이터' : '현재 공통 필터의 원본 데이터'} · {page + 1}페이지
                </caption>
                <thead>
                  <tr>
                    {contribution && (
                      <th scope="col" style={{ minWidth: 128 }}>
                        집계 구성요소
                      </th>
                    )}
                    {data.fields.map(field => (
                      <th scope="col" key={field.columnName}>
                        {field.columnName}
                        <Typography component="div" variant="caption">
                          {field.columnType}
                        </Typography>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.datas.map((row, index) => (
                    <tr key={index}>
                      {contribution && (
                        <td style={{ minWidth: 128 }}>
                          {data.contributionComponents[index].map(label => (
                            <Box
                              component="span"
                              key={label}
                              sx={{
                                display: 'inline-block',
                                boxSizing: 'border-box',
                                maxWidth: '100%',
                                mr: 0.5,
                                mb: 0.5,
                                px: 0.75,
                                py: 0.25,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                fontSize: 12,
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {label}
                            </Box>
                          ))}
                        </td>
                      )}
                      {data.fields.map(field => (
                        <td key={field.columnName}>
                          {cellText(
                            Object.prototype.hasOwnProperty.call(row, field.columnName) ? row[field.columnName] : undefined,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
            {!data.datas.length && <Typography sx={{ mt: 1 }}>현재 조건에 해당하는 원본 행이 없습니다.</Typography>}
          </>
        )}
        <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="페이지당 행 수"
            sx={{ minWidth: 150, maxWidth: '100%', flexShrink: 0 }}
            size="small"
            value={pageSize}
            disabled={busy || !!blocked || !!error}
            onChange={event => setPagination({ contextKey, page: 0, pageSize: Number(event.target.value) })}
          >
            {[25, 50, 100].map(size => (
              <MenuItem key={size} value={size}>
                {size}행
              </MenuItem>
            ))}
          </TextField>
          <Button disabled={busy || !data || page === 0} onClick={() => changePage(page - 1)}>
            이전 페이지
          </Button>
          <Button disabled={busy || !canNext} onClick={() => changePage(page + 1)}>
            다음 페이지
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button ref={closeButton} onClick={onClose} sx={{ minHeight: 44 }}>
          원본 상세 닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
