import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { get, del } from '@/helpers/apiHelper';
import PivotTable from '@/pages/Explore/PivotTable';
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
                  !item.state?.pivot ||
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
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={() => setReload(v => v + 1)}>Pivot 다시 불러오기</Button>
      </Alert>
    );
  if (!items.length) return null;
  return (
    <Box
      component="section"
      aria-label="대시보드 Pivot"
      sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gap: 2, minWidth: 0 }}
    >
      {items.map(item => (
        <DashboardPivot
          key={item.id}
          item={item}
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
    </Box>
  );
}
function DashboardPivot(props: any) {
  const { item, onRemove, removing } = props;
  if (!item.error) return <ValidDashboardPivot {...props} />;
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0, borderRadius: 2, boxShadow: 'none' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>
          {item.name}
        </Typography>
        <Button
          size="small"
          disabled={removing}
          onClick={onRemove}
          aria-label={`${item.name} 대시보드에서 제거`}
          sx={{ flexShrink: 0, minHeight: 36 }}
        >
          제거
        </Button>
      </Stack>
      <Alert severity="warning" sx={{ mt: 1 }}>
        {item.error}
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        다른 차트와 원본 저장 보기는 유지됩니다. 이 Pivot을 제거하고 탐색 화면에서 갱신한 저장 보기를 다시 추가해 주세요.
      </Typography>
    </Card>
  );
}
function ValidDashboardPivot({ item, common, dateRange, paused, onFilter, onRemove, removing }: any) {
  const filters = useMemo(() => mergePivotFilters(item.state.filters, common), [item.state.filters, common]);
  const range: ExploreDateRange | undefined = dateRange ?? item.state.dateRange ?? undefined;
  const timeUnsupported = !!range && (!/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end));
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0, borderRadius: 2, boxShadow: 'none' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>
          {item.name}
        </Typography>
        <Button
          size="small"
          disabled={removing}
          onClick={onRemove}
          aria-label={`${item.name} 대시보드에서 제거`}
          sx={{ flexShrink: 0, minHeight: 36 }}
        >
          제거
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        공통 필터·기간 우선 적용 · 없는 조건은 저장한 보기의 기본값 사용
      </Typography>
      {filters.length > 5 && <Alert severity="warning">기본·공통 필터가 5개를 초과했습니다. 필터를 줄여 주세요.</Alert>}
      {timeUnsupported && (
        <Alert severity="warning">Pivot은 날짜 범위를 지원합니다. 공통 기간을 날짜 단위로 선택해 주세요.</Alert>
      )}
      <Typography variant="caption" component="p" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
        기간 {range ? `${range.start} ~ ${range.end} · ${range.timeZone ?? 'UTC'}` : '전체'} · 필터{' '}
        {filters.map(f => f.column).join(', ') || '없음'}
      </Typography>
      <PivotTable
        embedded
        sourceId={item.sourceId}
        sourceRevision={item.sourceRevision}
        dimensions={item.dimensions}
        measureIds={item.state.measureIds}
        fixedAxes
        axes={item.state.pivot}
        filters={filters}
        dateRange={range}
        paused={paused || filters.length > 5 || timeUnsupported}
        onFilter={next => {
          const changed = next.filter(f => !filters.some(old => JSON.stringify(old) === JSON.stringify(f)));
          if (changed.length) onFilter(mergePivotFilters(common, changed));
        }}
        onReloadCatalog={() => window.location.reload()}
      />
    </Card>
  );
}
