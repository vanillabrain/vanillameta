import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { acquirePivotRequest, type PivotRequestPool } from '@/pages/Explore/pivotRequests';
import SegmentPivotDetails from '@/pages/Explore/SegmentPivotDetails';
import ExploreExport from '@/pages/Explore/ExploreExport';
import type { SegmentResult } from '@/pages/Explore/AggregateSegment';
import type { ExploreDateRange, ExploreFilter, ExploreViewState } from '@/pages/Explore/exploreViewState';
import { formatMetric } from '@/utils/formatMetric';

const operators: Record<string, string> = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=' };
/** Raw dashboard filters are sent before qualification, never as a list of visible qualified groups. */
export default function DashboardSegmentPivot({
  item,
  filters,
  dateRange,
  paused,
  requestPool,
}: {
  item: {
    name?: string;
    sourceId: number;
    sourceRevision: string;
    revision: string;
    state: ExploreViewState & { segment: NonNullable<ExploreViewState['segment']> };
  };
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  paused: boolean;
  requestPool: PivotRequestPool;
}) {
  const [response, setResponse] = useState<{ key: string; result: SegmentResult } | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const segment = item.state.segment ?? { dimensionColumn: '', conditions: [] };
  const body = {
    sourceId: item.sourceId,
    sourceRevision: item.sourceRevision,
    catalogRevision: item.revision,
    ...segment,
    measureIds: item.state.measureIds,
    filters,
    ...(dateRange ? { dateRange } : {}),
    trendGrain: item.state.trendGrain,
  };
  const key = JSON.stringify(body);
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const fence = captureAuthResponseFence();
    setResponse(null);
    setError('');
    setConflict(false);
    let subscription: ReturnType<typeof acquirePivotRequest> | undefined;
    if (paused) return;
    // Debounce every scope change, including dates; dashboard-local pool shares identical in-flight reads.
    const timer = window.setTimeout(() => {
      try {
        fence();
        subscription = acquirePivotRequest(requestPool, key, body, '/bi/explore/segments');
        void subscription.promise
          .then(r => {
            if (generation.current !== token) return;
            fence();
            const result = r.data?.data as SegmentResult;
            if (
              r.data?.status !== 'SUCCESS' ||
              result?.sourceRevision !== item.sourceRevision ||
              !result.pivot ||
              !Array.isArray(result.kpis) ||
              !Array.isArray(result.groups)
            )
              throw new Error('Invalid Pivot');
            setResponse({ key, result });
          })
          .catch(e => {
            if (generation.current !== token) return;
            setConflict(e?.response?.status === 409);
            setError(
              e?.response?.status === 403
                ? '접근 권한이 변경되었습니다. 로그인과 소스 권한을 확인해 주세요.'
                : e?.response?.status === 409
                ? '데이터·지표 정의가 변경되었습니다. 대시보드를 다시 불러와 주세요.'
                : '집계 조건 Pivot을 불러오지 못했습니다. 현재 조건으로 다시 시도해 주세요.',
            );
          });
      } catch {
        if (generation.current === token) setError('로그인 상태를 확인한 뒤 대시보드를 다시 불러와 주세요.');
      }
    }, 250);
    return () => {
      generation.current += 1;
      window.clearTimeout(timer);
      subscription?.release();
    };
  }, [key, paused, retry, requestPool]);
  const result = !paused && response?.key === key ? response.result : null;
  const metricText = (metric: SegmentResult['kpis'][number], value: unknown) => {
    const unit = metric.unit.trim();
    return formatMetric(value, {
      decimalPlaces: metric.decimalPlaces,
      ...(['$', '€', '₩', '£', '¥'].includes(unit)
        ? { prefix: unit }
        : { suffix: unit === '%' ? '%' : unit ? ` ${unit}` : '' }),
    }).text;
  };
  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1 rounded-lg bg-muted/40 p-3">
        <p className="break-words text-sm font-medium">
          {segment.conditions
            .map(
              c =>
                `${result?.kpis.find(m => m.id === c.measureId)?.label ?? `지표 ${c.measureId}`} ${operators[c.operator]} ${
                  c.value
                }`,
            )
            .join(' · ')}
        </p>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">
          원본 필터 → {segment.dimensionColumn}별 모든 조건 → 기여 행 재집계 · 비율은 원본에서 다시 계산
        </p>
      </div>
      {paused ? (
        <Notice severity="info">기간·필터 입력을 완성하면 집계 조건 Pivot을 다시 계산합니다.</Notice>
      ) : error ? (
        <Notice severity="error">
          {error}
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => (conflict ? window.location.reload() : setRetry(n => n + 1))}
          >
            {conflict ? '대시보드 다시 불러오기' : '집계 Pivot 다시 조회'}
          </Button>
        </Notice>
      ) : result ? (
        <>
          <div role="group" aria-label={`${item.name ?? '집계 조건 Pivot'} CSV 내보내기`} className="w-full min-w-0">
            <ExploreExport
              summary={
                <p role="status" className="min-w-0 break-words py-2 text-sm font-medium">
                  조건에 맞는 대상 {result.scope.totalGroups}개 · 원본 {result.scope.rows}행
                </p>
              }
              payload={{ mode: 'segment', query: { ...body, viewRevision: result.viewRevision } }}
              disabled={!result.viewRevision}
            />
          </div>
          {Number(result.scope.totalGroups) === 0 && (
            <Notice severity="info">조건에 맞는 대상이 없습니다. 공통 필터나 기간을 조정해 주세요.</Notice>
          )}
          <SegmentPivotDetails
            embedded
            result={result}
            query={{ ...body, viewRevision: result.viewRevision }}
            metricText={metricText}
          />
        </>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          현재 조건으로 집계 Pivot을 계산하는 중…
        </p>
      )}
    </div>
  );
}
