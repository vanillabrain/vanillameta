import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { get, del } from '@/helpers/apiHelper';
import PivotTable from '@/pages/Explore/PivotTable';
import DashboardSegmentPivot from './DashboardSegmentPivot';
import DashboardSegmentExplore from './DashboardSegmentExplore';
import type { PivotRequestPool } from '@/pages/Explore/pivotRequests';
import type { ExploreFilter, ExploreDateRange } from '@/pages/Explore/exploreViewState';
export function mergePivotFilters(saved: ExploreFilter[], common: ExploreFilter[]) {
  return [...saved.filter(filter => !common.some(c => c.column === filter.column)), ...common];
}
export default function DashboardPivots({
  dashboardId,
  filters,
  dateRange,
  paused,
  onFilter,
}: {
  dashboardId: number;
  filters: ExploreFilter[];
  dateRange?: any;
  paused: boolean;
  onFilter: (filters: ExploreFilter[]) => void;
}) {
  const requestPool = useMemo<PivotRequestPool>(() => new Map(), [dashboardId]);
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true),
    [removing, setRemoving] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setItems([]);
    get(`/bi/dashboard/${dashboardId}/pivots`, undefined, { signal: abort.signal })
      .then(r => {
        if (
          r.data.status !== 'SUCCESS' ||
          !Array.isArray(r.data.data) ||
          r.data.data.some(
            (item: any) =>
              !item?.id ||
              (!item.error &&
                (!Array.isArray(item.dimensions) ||
                  !Array.isArray(item.state?.measureIds) ||
                  !(item.state?.pivot || (item.state?.mode === 'segment' && item.state?.segment?.pivotColumn)) ||
                  !Array.isArray(item.state.filters) ||
                  typeof item.sourceRevision !== 'string')),
          )
        )
          throw new Error('Pivot 응답을 확인할 수 없습니다.');
        if (!abort.signal.aborted) setItems(r.data.data);
      })
      .catch((e: any) => {
        if (!abort.signal.aborted) setError(e.response?.data?.data?.message || '대시보드 Pivot을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [dashboardId, reload]);
  const commonKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [commonKey]);
  if (loading) return null;
  if (error)
    return (
      <Notice severity="error" className="m-4">
        {error}
        <Button variant="ghost" size="sm" className="ml-2" onClick={() => setReload(v => v + 1)}>
          Pivot 다시 불러오기
        </Button>
      </Notice>
    );
  if (!items.length) return null;
  return (
    <section aria-label="대시보드 Pivot" className="grid min-w-0 gap-4 p-3 md:p-4">
      {items.map(item => (
        <DashboardPivot
          key={item.id}
          item={item}
          requestPool={requestPool}
          onReload={() => setReload(v => v + 1)}
          common={stableFilters}
          dateRange={dateRange}
          paused={paused}
          onFilter={onFilter}
          removing={removing === item.id}
          onRemove={async () => {
            setRemoving(item.id);
            try {
              await del(`/bi/dashboard/${dashboardId}/pivots/${item.id}`);
              setReload(v => v + 1);
            } catch {
              setError('Pivot을 제거하지 못했습니다.');
            } finally {
              setRemoving('');
            }
          }}
        />
      ))}
    </section>
  );
}
function pivotCardHeader(item: any, removing: boolean, onRemove: () => void) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="min-w-0 text-base leading-snug font-semibold sm:text-lg [overflow-wrap:anywhere]">{item.name}</h2>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-9 shrink-0"
        disabled={removing}
        onClick={onRemove}
        aria-label={`${item.name} 대시보드에서 제거`}
      >
        제거
      </Button>
    </div>
  );
}
function DashboardPivot(props: any) {
  const { item, onRemove, removing } = props;
  if (!item.error) return <ValidDashboardPivot {...props} />;
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>{pivotCardHeader(item, removing, onRemove)}</CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <Notice severity="warning">{item.error}</Notice>
        <p className="text-sm text-muted-foreground">
          다른 차트와 원본 저장 보기는 유지됩니다. 이 Pivot을 제거하고 탐색 화면에서 갱신한 저장 보기를 다시 추가해 주세요.
        </p>
      </CardContent>
    </Card>
  );
}
function ValidDashboardPivot({ item, common, dateRange, paused, onFilter, onRemove, removing, requestPool, onReload }: any) {
  const filters = useMemo(() => mergePivotFilters(item.state.filters, common), [item.state.filters, common]);
  const range: ExploreDateRange | undefined = dateRange ?? item.state.dateRange ?? undefined;
  const timeUnsupported = !!range && (!/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end));
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>{pivotCardHeader(item, removing, onRemove)}</CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          공통 필터·기간 우선 적용 · 없는 조건은 저장한 보기의 기본값 사용
        </p>
        {filters.length > 5 && <Notice severity="warning">기본·공통 필터가 5개를 초과했습니다. 필터를 줄여 주세요.</Notice>}
        {timeUnsupported && (
          <Notice severity="warning">Pivot은 날짜 범위를 지원합니다. 공통 기간을 날짜 단위로 선택해 주세요.</Notice>
        )}
        <p className="text-xs [overflow-wrap:anywhere]">
          기간 {range ? `${range.start} ~ ${range.end} · ${range.timeZone ?? 'UTC'}` : '전체'} · 필터{' '}
          {filters.map(f => f.column).join(', ') || '없음'}
        </p>
        {item.state.mode === 'segment' && Array.isArray(item.measures) && (
          <DashboardSegmentExplore
            item={item}
            filters={filters}
            dateRange={range}
            paused={paused || filters.length > 5 || timeUnsupported}
            onReload={onReload}
          />
        )}
        {item.state.mode === 'segment' ? (
          <DashboardSegmentPivot
            item={item}
            filters={filters}
            dateRange={range}
            paused={paused || filters.length > 5 || timeUnsupported}
            requestPool={requestPool}
          />
        ) : (
          <PivotTable
            embedded
            requestPool={requestPool}
            filterDelayMs={250}
            sourceId={item.sourceId}
            sourceRevision={item.sourceRevision}
            dimensions={item.dimensions}
            measureIds={item.state.measureIds}
            fixedAxes
            axes={item.state.pivot}
            filters={filters}
            dateRange={range}
            paused={paused || filters.length > 5 || timeUnsupported}
            pauseReason={
              filters.length > 5
                ? 'Pivot 집계를 중지했습니다. 기본·공통 필터를 5개 이하로 줄여 주세요.'
                : timeUnsupported
                ? 'Pivot 집계를 중지했습니다. 공통 기간을 날짜 단위로 선택해 주세요.'
                : undefined
            }
            onFilter={next => {
              const changed = next.filter(f => !filters.some(old => JSON.stringify(old) === JSON.stringify(f)));
              if (changed.length) onFilter(mergePivotFilters(common, changed));
            }}
            onReloadCatalog={() => window.location.reload()}
          />
        )}
      </CardContent>
    </Card>
  );
}
