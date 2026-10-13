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
import type { DateRange, FilterValue } from './PersonalSavedViews';
import { timeRangeLabel } from './timeSelection';

type Props = {
  open: boolean;
  dashboardId: number;
  draft: unknown;
  filters: { column: string; values: FilterValue[] }[];
  dateRange?: DateRange | null;
  sourceRevision?: string;
  disabledReason?: string;
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
};
export function canRequestNextPage(page: number, pageSize: number, totalRows: string) {
  return page < 10000 && BigInt(page + 1) * BigInt(pageSize) < BigInt(totalRows);
}
function errorText(error: unknown) {
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
      ? `원본 데이터 버전이 변경되었습니다. 대시보드 데이터를 새로 조회한 뒤 상세를 다시 열어 주세요.${
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
  sourceRevision,
  disabledReason = '',
  onClose,
  onRefresh,
  onExited,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const contextKey = JSON.stringify({ dashboardId, draft, filters, dateRange: dateRange ?? null, sourceRevision });
  const [pagination, setPagination] = useState({ contextKey, page: 0, pageSize: 25 });
  const page = pagination.contextKey === contextKey ? pagination.page : 0;
  const pageSize = pagination.pageSize;
  const [reload, setReload] = useState(0);
  const blocked = disabledReason || (!sourceRevision ? '데이터 버전을 확인한 뒤 원본 행을 조회할 수 있습니다.' : '');
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
          sourceRevision,
          page,
          pageSize,
        },
        { timeout: 60000, signal: controller.signal },
      )
        .then(response => {
          if (controller.signal.aborted || request !== serial.current || currentKey.current !== requestKey) return;
          if (response?.data?.status !== 'SUCCESS') throw Object.assign(new Error('원본 행 조회 실패'), { response });
          const data = response.data.data as DetailData;
          if (
            !data ||
            (data.scope !== undefined && data.scope !== 'current common-filter source rows') ||
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
            data.sourceRevision !== sourceRevision
          )
            throw new Error('원본 행 응답의 조건 또는 데이터 버전을 확인할 수 없습니다. 다시 조회해 주세요.');
          setResult({ key: requestKey, data });
        })
        .catch(error => {
          if (!controller.signal.aborted && request === serial.current && currentKey.current === requestKey)
            setResult({ key: requestKey, error: errorText(error) });
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
      <DialogTitle id={titleId}>현재 공통 필터의 원본 행</DialogTitle>
      <DialogContent sx={{ minWidth: 0 }}>
        <Typography id={descriptionId} variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
          현재 공통 필터와 적용 기간에 해당하는 원본 데이터입니다. 개별 차트에 설정한 추가 조건은 포함하지 않습니다.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
          {dateRange
            ? `${dateRange.column}: ${
                dateRange.precision === 'timestamp'
                  ? timeRangeLabel(dateRange)
                  : `${dateRange.start} ~ ${dateRange.end} (UTC)`
              }`
            : '전체 기간'}{' '}
          ·{' '}
          {filters.length
            ? filters.map(filter => `${filter.column}: ${filter.values.map(cellText).join(', ')}`).join(' · ')
            : '필터 없음'}
        </Typography>
        {sourceRevision && <Typography variant="caption">데이터 버전: {sourceRevision.slice(0, 12)}</Typography>}
        {blocked && <Alert severity="info">{blocked} 이전 원본 행은 표시하지 않습니다.</Alert>}
        {busy && <LinearProgress aria-label="원본 행 조회 중" sx={{ my: 1 }} />}
        {error && (
          <Alert severity="error">
            {error.message}
            <Button onClick={error.stale ? onRefresh : () => setReload(value => value + 1)}>
              {error.stale ? '대시보드 데이터 새로 조회' : '원본 행 다시 조회'}
            </Button>
          </Alert>
        )}
        {data && (
          <>
            {data.columnCount !== undefined && data.columnCount > 50 && (
              <Alert severity="info">원본 {data.columnCount}개 컬럼 중 처음 50개 컬럼만 표시합니다.</Alert>
            )}
            {page >= 10000 && BigInt(page + 1) * BigInt(pageSize) < BigInt(data.totalRows) && (
              <Alert severity="info">조회 한도에 도달했습니다. 필터로 범위를 좁혀 주세요.</Alert>
            )}
            <Typography role="status" aria-live="polite" sx={{ my: 1 }}>
              총 {data.totalRows}행 · {page + 1}페이지 · 현재 {data.datas.length}행
            </Typography>
            <Box
              role="region"
              aria-label="현재 공통 필터의 원본 행 표"
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
                <caption>현재 공통 필터의 원본 데이터 · {page + 1}페이지</caption>
                <thead>
                  <tr>
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
        <Button onClick={onClose}>원본 상세 닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
