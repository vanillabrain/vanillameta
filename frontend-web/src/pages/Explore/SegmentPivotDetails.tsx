import React, { useEffect, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SegmentResult } from './AggregateSegment';
import SegmentPivot, { type SegmentSelection } from './SegmentPivot';

type DetailResult = Pick<SegmentResult, 'sourceRevision' | 'viewRevision' | 'kpis' | 'details'> & {
  selection: SegmentSelection;
};
const text = (v: unknown) =>
  v === null ? '(값 없음)' : v === '' ? '(빈 문자열)' : typeof v === 'object' ? JSON.stringify(v) : String(v);
/** Selected details never modify the qualification query, base result, saved state or CSV. */
export default function SegmentPivotDetails({
  result,
  query,
  metricText,
  embedded = false,
}: {
  result: SegmentResult;
  query: Record<string, unknown>;
  metricText: (metric: SegmentResult['kpis'][number], value: unknown) => string;
  embedded?: boolean;
}) {
  const scope = JSON.stringify(query);
  const [chosen, setChosen] = useState<{ scope: string; axes: SegmentSelection } | null>(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; value: DetailResult } | null>(null);
  const [failure, setFailure] = useState<{ key: string; status?: number } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const generation = useRef(0);
  const open = !!chosen && chosen.scope === scope;
  const request = open ? { ...query, viewRevision: result.viewRevision, selection: chosen.axes, page, pageSize: 20 } : null;
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    const abort = new AbortController();
    setResponse(null);
    setFailure(null);
    if (request) {
      void (async () => {
        try {
          const fence = captureAuthResponseFence();
          fence();
          const raw = await post('/bi/explore/segments/details', request, { signal: abort.signal });
          if (generation.current !== current || abort.signal.aborted) return;
          fence();
          const data = raw?.data?.data as DetailResult;
          if (
            raw?.data?.status !== 'SUCCESS' ||
            data?.sourceRevision !== result.sourceRevision ||
            data?.viewRevision !== result.viewRevision ||
            JSON.stringify(data?.selection) !== JSON.stringify(request.selection) ||
            !Array.isArray(data?.details?.rows) ||
            !Array.isArray(data?.kpis) ||
            data.details.page !== page ||
            data.details.pageSize !== 20
          )
            throw new Error('Invalid detail response');
          setResponse({ key: requestKey, value: data });
        } catch (error) {
          if (generation.current === current && !abort.signal.aborted)
            setFailure({ key: requestKey, status: (error as any)?.response?.status });
        }
      })();
    }
    return () => {
      generation.current += 1;
      abort.abort();
    };
  }, [requestKey, retry]);
  const data = response?.key === requestKey ? response.value : null;
  const error = failure?.key === requestKey ? failure : null;
  const busy = open && !data && !error;
  const description = chosen
    ? [
        ...('row' in chosen.axes ? [`${result.scope.dimensionColumn}: ${text(chosen.axes.row)}`] : []),
        ...('column' in chosen.axes ? [`${result.pivot?.column}: ${text(chosen.axes.column)}`] : []),
      ].join(' · ') || '전체 합계'
    : '';
  const columns = Object.keys(data?.details.rows[0] ?? {});
  return (
    <>
      <SegmentPivot
        result={result}
        metricText={metricText}
        embedded={embedded}
        onSelect={(axes, origin) => {
          trigger.current = origin;
          setPage(0);
          setChosen({ scope, axes });
        }}
      />
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) setChosen(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto]"
          style={{ width: 'calc(100vw - 2rem)', maxWidth: 1100 }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
          }}
        >
          <DialogHeader className="pr-6">
            <DialogTitle>Pivot 기여 원본</DialogTitle>
            <DialogDescription className="break-words">
              {description} · 원본 필터와 집계 조건 판정 후 이 범위에 기여한 행입니다. 원래 Pivot·저장 조건은 바꾸지
              않습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
            {busy && (
              <p role="status" className="py-4 text-sm text-muted-foreground">
                선택한 범위의 기여 원본을 확인하는 중…
              </p>
            )}
            {error && (
              <Notice severity="error">
                {error.status === 409
                  ? '데이터 또는 집계 정의가 변경되었습니다. 닫고 원래 Pivot을 다시 조회해 주세요.'
                  : error.status === 401 || error.status === 403
                  ? '기여 원본을 조회할 권한이 없습니다. 로그인과 소스 권한을 확인해 주세요.'
                  : '기여 원본을 불러오지 못했습니다. 같은 범위로 다시 시도해 주세요.'}
                {![401, 403, 409].includes(error.status ?? 0) && (
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => setRetry(n => n + 1)}>
                      기여 원본 다시 조회
                    </Button>
                  </div>
                )}
              </Notice>
            )}
            {data && (
              <>
                <div className="flex min-w-0 flex-wrap gap-3 rounded-lg border bg-muted/30 p-3">
                  {data.kpis.map(m => (
                    <div key={m.id} className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="break-words text-lg font-semibold tabular-nums">{metricText(m, m.value)}</p>
                    </div>
                  ))}
                </div>
                <p role="status" className="text-sm">
                  기여 원본 {data.details.totalRows}행 · 페이지 {data.details.page + 1} · 읽기 전용
                </p>
                {data.details.rows.length ? (
                  <div
                    role="region"
                    aria-label="선택 Pivot 기여 원본 표"
                    tabIndex={0}
                    className="max-w-full overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onKeyDown={event => {
                      if (
                        event.target !== event.currentTarget ||
                        event.altKey ||
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey
                      )
                        return;
                      const e = event.currentTarget,
                        max = e.scrollWidth - e.clientWidth;
                      if (max <= 0 || !['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                      event.preventDefault();
                      e.scrollLeft =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                          ? max
                          : Math.max(0, Math.min(max, e.scrollLeft + (event.key === 'ArrowRight' ? 80 : -80)));
                    }}
                  >
                    <table className="w-full caption-bottom text-sm">
                      <TableCaption className="sr-only">집계 조건 판정 뒤 선택한 행·열 범위 · 최대50개 원본 열</TableCaption>
                      <TableHeader>
                        <TableRow>
                          {columns.map(c => (
                            <TableHead key={c}>{c}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.details.rows.map((row, i) => (
                          <TableRow key={i}>
                            {columns.map(c => (
                              <TableCell key={c} className="max-w-64 whitespace-nowrap tabular-nums">
                                {text(row[c])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>
                ) : (
                  <Notice severity="info">이 범위에 기여한 원본 행이 없습니다.</Notice>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  최대50개 원본 열 · 표 안에서 가로 스크롤 · Home/End로 처음/마지막 열 이동
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>
                    이전 기여 원본
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || (page + 1) * data.details.pageSize >= Number(data.details.totalRows)}
                    onClick={() => setPage(n => n + 1)}
                  >
                    다음 기여 원본
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end border-t pt-3">
            <Button variant="outline" onClick={() => setChosen(null)}>
              기여 원본 닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
