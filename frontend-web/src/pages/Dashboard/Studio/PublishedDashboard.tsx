import AnalysisBasis, { analysisFilterBasis } from '@/components/analysis/AnalysisBasis';
import { PublishedBlockView } from './PublishedBlockView';
export { PublishedBlockView } from './PublishedBlockView';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import IconLogo from '@/assets/images/logo.svg?react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useMinWidth } from '@/components/PageViewBox';
import { useParams } from 'react-router-dom';
import { fetchPublished, PublishedSnapshot, publicationError, publicationTime } from './studioPublication';
import { studioDateRangeSummary, studioFilterChipText } from './studioDocument';
import { STUDIO_COLUMNS } from './studioTypes';
import './studio.css';

export default function PublishedDashboard() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublishedSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const checkedExpiry = useRef<string | null>(null);
  const desktop = useMinWidth(1200);
  const tablet = useMinWidth(600);
  const breakpoint = desktop ? 'lg' : tablet ? 'md' : 'xs';
  const load = useCallback(async () => {
    generation.current += 1;
    const version = generation.current;
    // Never leave previously authorized data visible while a new authorization check is pending.
    setData(null);
    setLoading(true);
    setError('');
    try {
      const value = await fetchPublished(token);
      if (generation.current === version) setData(value);
    } catch (cause) {
      if (generation.current === version) setError(publicationError(cause));
    } finally {
      if (generation.current === version) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    load();
    const visible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) load();
    };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', pageshow);
    return () => {
      generation.current += 1;
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pageshow', pageshow);
    };
  }, [load]);
  useEffect(() => {
    if (!data?.expiresAt) return;
    const remaining = Date.parse(data.expiresAt) - Date.now();
    const key = data.token + ':' + data.version + ':' + data.expiresAt;
    // A device clock can be ahead of the server. Revalidate once at the local deadline;
    // a still-authorized server response stays visible and is checked on focus/refresh.
    if (remaining <= 0) {
      if (checkedExpiry.current !== key) {
        checkedExpiry.current = key;
        load();
        return;
      }
      const retry = window.setTimeout(load, 30000);
      return () => clearTimeout(retry);
    }
    const timer = window.setTimeout(() => {
      checkedExpiry.current = key;
      load();
    }, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [data, load]);
  const snapshot = data?.snapshot;
  const layout = snapshot?.layouts?.[breakpoint] ?? [];
  const ordered = snapshot
    ? [...snapshot.blocks].sort((a, b) => {
        const x = layout.find(item => item.id === a.id),
          y = layout.find(item => item.id === b.id);
        return (x?.y ?? 0) - (y?.y ?? 0) || (x?.x ?? 0) - (y?.x ?? 0);
      })
    : [];
  return (
    <div className="vm-studio studio-published">
      <a className="studio-skip" href="#published-main">
        대시보드로 건너뛰기
      </a>
      <header className="studio-published-header">
        <a className="studio-brand" href="/" aria-label="VanillaMeta">
          <IconLogo aria-hidden="true" />
        </a>
        <span>게시된 대시보드 · 읽기 전용</span>
        <div className="studio-published-actions">
          {data?.allowRemix && (
            <Button asChild>
              <a href={'/published/' + encodeURIComponent(token) + '/remix'}>내 데이터로 복제</a>
            </Button>
          )}
          <Button
            variant="outline"
            aria-disabled={loading}
            aria-busy={loading}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
              if (!loading) void load();
            }}
          >
            다시 확인
          </Button>
        </div>
      </header>
      <main id="published-main">
        {loading && <p role="status">게시 권한과 데이터를 확인하고 있습니다…</p>}
        {error && (
          <Notice severity="warning" role="alert">
            {error}
          </Notice>
        )}
        {data && snapshot && (
          <>
            <div className="studio-published-heading">
              <div>
                <span className="studio-eyebrow">PUBLISHED SNAPSHOT · V{data.version}</span>
                <h1>{snapshot.title}</h1>
              </div>
              <span className="studio-published-badge">{data.visibility === 'link' ? '링크 공개' : '비공개'}</span>
            </div>
            <AnalysisBasis
              className="mb-4"
              status={`게시본 · V${data.version} · 읽기 전용`}
              data="게시 시점의 집계 데이터"
              period={
                snapshot.dateRange
                  ? studioDateRangeSummary(snapshot.dateRange)
                  : (snapshot.periodLabel || '전체 기간') + (snapshot.periodLabel?.includes('UTC') ? '' : ' · UTC')
              }
              filters={analysisFilterBasis(snapshot.filters, !!snapshot.conditionsApplied)}
              metrics={
                snapshot.blocks
                  .map(
                    block =>
                      block.title +
                      ([block.display.prefix, block.display.suffix].map(value => value?.trim()).filter(Boolean).length
                        ? ' (' +
                          [block.display.prefix, block.display.suffix]
                            .map(value => value?.trim())
                            .filter(Boolean)
                            .join(' ') +
                          ')'
                        : ''),
                  )
                  .join(' · ') || '지표 없음'
              }
              details={[{ label: '집계 시각', value: publicationTime(data.asOf) }]}
              note="게시 시점에 고정된 결과입니다. 현재 원본 데이터나 편집 중인 초안과 다를 수 있습니다. 블록별 추가 조건은 공개된 설명을 확인하세요."
            />
            <div className="studio-published-asof">
              <span>{snapshot.periodLabel || '전체 기간'} · 게시 시점의 집계</span>
              <span>집계 시각 {publicationTime(data.asOf)}</span>
              {data.expiresAt && <span>만료 {publicationTime(data.expiresAt)}</span>}
            </div>
            {!!(snapshot.filters ?? []).length && (
              <div className="studio-published-filters" role="note" aria-label="게시 시점 공통 필터">
                <span className="studio-eyebrow">게시 시점 공통 필터 · 읽기 전용</span>
                {(snapshot.filters ?? []).map(filter => (
                  <span className="studio-published-filter" key={filter.column}>
                    {studioFilterChipText(filter)}
                  </span>
                ))}
              </div>
            )}
            {snapshot.conditionsApplied && <p role="note">포함·제외 조건 적용됨</p>}
            {snapshot.dateRange && (
              <div className="studio-published-filters" role="note" aria-label="게시 시점 공통 기간">
                <span className="studio-eyebrow">게시 시점 공통 기간 · 읽기 전용</span>
                <span className="studio-published-filter">{studioDateRangeSummary(snapshot.dateRange)}</span>
              </div>
            )}
            <p className="studio-published-note">
              실시간 데이터가 아닙니다. 원본이 바뀌어도 소유자가 재게시하기 전까지 이 결과를 유지합니다.
            </p>
            <div
              className="studio-published-grid"
              style={{ gridTemplateColumns: `repeat(${STUDIO_COLUMNS[breakpoint]}, minmax(0, 1fr))` }}
            >
              {ordered.map(block => {
                const item = layout.find(candidate => candidate.id === block.id);
                return (
                  <article
                    className="studio-published-card"
                    key={block.id}
                    aria-label={block.title + ' 게시 블록'}
                    style={{
                      gridColumn: item ? `${item.x + 1} / span ${item.w}` : '1 / -1',
                      gridRow: item ? `${item.y + 1} / span ${item.h}` : undefined,
                    }}
                  >
                    <PublishedBlockView block={block} />
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
      <footer>VanillaMeta · 게시 스냅샷</footer>
    </div>
  );
}
