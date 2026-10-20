import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { formatMetric } from '@/utils/formatMetric';
import StudioReport from '@/pages/Dashboard/Studio/StudioReport';
import { parseExploreViewState } from './exploreViewState';

/** A saved report's read-only entry: source/measure versions are checked again by the query. */
export default function ReportExplore({ search }: { search: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let live = true;
    setValue(null);
    setError('');
    setLoading(true);
    const run = async () => {
      try {
        const params = new URLSearchParams(search),
          id = params.get('studioDashboard');
        if (!id || !/^[1-9]\d*$/.test(id)) throw Error('저장된 보고서 주소를 확인해 주세요.');
        const response = await get(
          '/studio/dashboards/' + id + '/explore',
          {
            blockId: params.get('studioBlock'),
            expectedRevision: params.get('studioRevision'),
            expectedSourceRevision: params.get('sourceRevision'),
          },
          { signal: abort.signal },
        );
        const handoff = response.data;
        const state = parseExploreViewState(handoff.state);
        if (
          handoff.sourceId !== Number(params.get('sourceId')) ||
          handoff.dashboardId !== Number(id) ||
          !Array.isArray(handoff.measureGuards)
        )
          throw Error('보고서의 기준을 확인하지 못했습니다.');
        const result = await post(
          '/bi/explore/query',
          {
            sourceId: handoff.sourceId,
            sourceRevision: handoff.sourceRevision,
            measureIds: state.measureIds,
            dimensionColumns: state.dimensionColumns,
            rankingMeasureId: state.rankingMeasureId,
            filters: state.filters,
            ...(state.dateRange ? { dateRange: state.dateRange } : {}),
            trendGrain: state.trendGrain,
            comparePrevious: false,
            includeRows: false,
            measureGuards: handoff.measureGuards,
          },
          { signal: abort.signal },
        );
        if (
          result.data?.status !== 'SUCCESS' ||
          result.data.data?.sourceRevision !== handoff.sourceRevision ||
          !Array.isArray(result.data.data?.kpis) ||
          result.data.data.kpis.length !== state.measureIds.length ||
          result.data.data.kpis.some((k: any) => !state.measureIds.includes(Number(k.id)))
        )
          throw Error('같은 기준의 집계 결과를 확인하지 못했습니다.');
        if (live) setValue({ handoff, state, result: result.data.data });
      } catch (cause: any) {
        if (!live || abort.signal.aborted) return;
        const status = cause?.response?.status;
        setError(
          status === 409
            ? '보고서·데이터·지표가 변경되었습니다. Studio에서 다시 조회한 뒤 열어 주세요.'
            : status === 401 || status === 403
            ? '이 보고서나 소스를 조회할 권한이 없습니다.'
            : status === 400
            ? '이 블록은 같은 조건 탐색을 지원하지 않습니다. 원본 Studio를 유지했습니다.'
            : '보고서 조건을 확인하지 못했습니다. 다시 시도해 주세요.',
        );
      } finally {
        if (live) setLoading(false);
      }
    };
    run();
    return () => {
      live = false;
      abort.abort();
    };
  }, [search, retry]);
  const h = value?.handoff,
    kpi = value?.result?.kpis?.[0];
  const origin = new URLSearchParams(search).get('studioDashboard');
  const display = {
    prefix: kpi?.prefix,
    suffix: kpi?.suffix,
    decimalPlaces: kpi?.decimalPlaces,
    numberNotation: 'full' as const,
  };
  return (
    <div className="mx-auto grid w-full max-w-[1400px] min-w-0 gap-4 p-4 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">보고서에서 이어지는 분석</p>
          <h1 className="text-xl font-semibold wrap-anywhere">{h?.blockTitle ?? '같은 조건으로 탐색'}</h1>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => setRetry(n => n + 1)}>
          다시 확인
        </Button>
      </div>
      {loading && <p role="status">보고서 권한·버전과 같은 조건의 집계를 확인하고 있습니다…</p>}
      {error && (
        <Notice severity="warning" role="alert">
          {error}
          {origin && /^[1-9]\d*$/.test(origin) && (
            <Button variant="outline" size="sm" asChild>
              <a href={'/dashboard/' + origin + '/studio'} target="_blank" rel="noopener noreferrer">
                원본 Studio ↗
              </a>
            </Button>
          )}
        </Notice>
      )}
      {h && (
        <>
          <Card className="min-w-0 gap-3 p-4">
            <p className="text-sm wrap-anywhere">
              {h.dashboardTitle}의 저장 지표·필터·기간으로 조회했습니다. 원본 보고서는 바꾸지 않습니다.
            </p>
            <p className="text-xs text-muted-foreground wrap-anywhere">
              {value.state.dateRange
                ? `${value.state.dateRange.start} ~ ${value.state.dateRange.end} · ${
                    value.state.dateRange.timeZone ?? 'UTC'
                  }`
                : '전체 기간 · UTC'}
              {' · 필터 ' + value.state.filters.length + '개 · 정의 v' + h.measureGuards[0]?.definitionVersion}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={'/dashboard/' + h.dashboardId + '/studio'} target="_blank" rel="noopener noreferrer">
                  원본 Studio ↗
                </a>
              </Button>
              <Button
                onClick={() =>
                  navigate('/explore/source?sourceId=' + h.sourceId, {
                    state: { initialExplore: { sourceId: h.sourceId, state: value.state } },
                  })
                }
              >
                이 조건에서 계속 분석
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              계속 분석하면 같은 조건을 시작점으로 현재 카탈로그의 지표·필터를 편집합니다.
            </p>
          </Card>
          {kpi && (
            <Card className="gap-2 p-4">
              <h2 className="text-sm font-medium">{kpi.title} · 같은 조건 합계</h2>
              <strong className="text-3xl tabular-nums" title={formatMetric(kpi.value, display).exactText}>
                {formatMetric(kpi.value, display).text}
              </strong>
            </Card>
          )}
          {(value.result.leaderboards ?? []).map((board: any) => (
            <Card className="min-w-0 p-4" key={board.column}>
              <StudioReport
                title={board.column}
                kind="CHART_BAR"
                presentation="table"
                display={display}
                rows={board.rows}
                categoryField="category"
                valueField="value"
              />
              {board.truncated && (
                <p className="text-xs text-muted-foreground">상위 20개만 표시합니다. 합계는 전체 그룹 기준입니다.</p>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
