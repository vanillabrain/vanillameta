import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMetric, metricNumericText, NumberNotation } from '@/utils/formatMetric';

import { MetricTrendData, trendBucketLabel, trendGeometry, trendTimeZone } from './trendGeometry';
import type { DateRange } from './PersonalSavedViews';
import { validTimeRange, sameTimeRange, timeRangeLabel } from './timeSelection';
import PeriodComparison, { MetricComparisonData } from './PeriodComparison';
import { comparisonTrend, TrendPeriods } from './comparisonTrend';

// Display retains server strings; chart coordinates use finite approximate numbers only.
export type FormattedMetricTrendData = Omit<MetricTrendData, 'points'> & {
  points: { time: string; value: number | string | null }[];
};
const geometryData = (trend: FormattedMetricTrendData): MetricTrendData => ({
  ...trend,
  points: trend.points.map(point => ({
    ...point,
    value: metricNumericText(point.value) !== null && Number.isFinite(Number(point.value)) ? Number(point.value) : null,
  })),
});

const contributionButtonClassName =
  'min-h-11 min-w-11 whitespace-normal text-left [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]';

export default function MetricTrend({
  trend,
  title,
  prefix = '',
  decimalPlaces = 0,
  numberNotation = 'full',
  unavailable,
  comparison,
  previousTrend,
  periods,
  suffix = '',
  onTimeSelect,
  timeSelectionDisabled = false,
  selectedTimeRange,
  onContributionSelect,
  contributionDisabled = false,
  contributionDisabledReason,
}: {
  trend?: FormattedMetricTrendData;
  title: string;
  prefix?: string;
  decimalPlaces?: number;
  numberNotation?: NumberNotation;
  unavailable?: string;
  comparison?: MetricComparisonData;
  previousTrend?: FormattedMetricTrendData;
  periods?: TrendPeriods;
  suffix?: string;
  onTimeSelect?: (range: DateRange) => void;
  timeSelectionDisabled?: boolean;
  selectedTimeRange?: DateRange | null;
  onContributionSelect?: (time: string) => void;
  contributionDisabled?: boolean;
  contributionDisabledReason?: string;
}) {
  const id = useId();
  const [activeTime, setActiveTime] = useState<string | null>(null);
  const selection = trend?.timeSelection;
  const rangeFor = (time: string) => {
    if (!trend || !selection || selection.ranges.length !== trend.points.length) return;
    const index = trend.points.findIndex(point => point.time === time);
    const range = selection.ranges[index];
    return validTimeRange(range) && range.column === selection.column ? range : undefined;
  };
  const selectable = (trend?.points || []).filter(point => rangeFor(point.time));
  const points = (trend?.points || []).filter(point => Number.isFinite(Date.parse(point.time)));
  const contributionInteractive = !!onContributionSelect && trend?.contribution?.supported === true && points.length > 0;
  const navigationPoints = contributionInteractive ? points : selectable;
  const active = navigationPoints.find(point => point.time === activeTime) || navigationPoints[0];
  const activeRange = active ? rangeFor(active.time) : undefined;
  const select = (time: string) => {
    const range = rangeFor(time);
    if (range && !timeSelectionDisabled) {
      setActiveTime(time);
      onTimeSelect?.(range);
    }
  };
  const interactive = !!onTimeSelect && selectable.length > 0;
  const contributionPointer = !onTimeSelect && contributionInteractive;
  const navigable = interactive || contributionInteractive;
  const contributionReason = contributionDisabledReason || trend?.contribution?.reason;
  const pointLabel = (time: string) =>
    trend?.timeZone && trend.timeZone !== 'UTC'
      ? `${trendBucketLabel(time, trend.grain, trend.timeZone)} ${trend.timeZone}`
      : time.replace('T', ' ').replace(/Z$/, ' UTC');
  const contribute = (time: string) => {
    if (contributionInteractive && !contributionDisabled && points.some(point => point.time === time)) {
      setActiveTime(time);
      onContributionSelect?.(time);
    }
  };
  const contributionButton = (time: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={contributionButtonClassName}
      aria-label={`이 시점의 집계 원본 행 보기: ${title} · ${pointLabel(time)}`}
      aria-disabled={contributionDisabled || undefined}
      aria-describedby={contributionDisabled && contributionReason ? `${id}-contribution-reason` : undefined}
      onFocus={() => setActiveTime(time)}
      onClick={() => contribute(time)}
    >
      이 시점의 집계 원본 행 보기
    </Button>
  );
  const numeric = points.filter(point => metricNumericText(point.value) !== null);
  const format = (value: unknown) => formatMetric(value, { prefix, suffix, decimalPlaces, numberNotation });
  const day = (time: string) => time.slice(0, 10);
  const zone = trendTimeZone(trend?.timeZone);
  const label = (time: string) => trendBucketLabel(time, trend?.grain, trend?.timeZone);
  // Overlay stays UTC-only: never compare regional (local-midnight) buckets against UTC periods.
  const overlayUtc = (data?: FormattedMetricTrendData) => !data?.timeZone || data.timeZone === 'UTC';
  const overlay =
    trend && previousTrend && periods && overlayUtc(trend) && overlayUtc(previousTrend)
      ? comparisonTrend(geometryData(trend), geometryData(previousTrend), periods)
      : undefined;
  const { path, area, dots } = overlay?.current ?? trendGeometry(geometryData({ ...trend, points }).points);
  const axisStart = overlay?.axes.start ?? Math.min(...points.map(point => Date.parse(point.time)));
  const axisEnd = overlay?.axes.end ?? Math.max(...points.map(point => Date.parse(point.time)));
  const grain =
    trend?.grain === 'hour' ? '시간별' : trend?.grain === 'month' ? '월별' : trend?.grain === 'week' ? '주별' : '일별';
  const summary = numeric.length
    ? `${title} ${grain} 추세, ${zone} ${label(points[0].time)}부터 ${label(points[points.length - 1].time)}까지. ` +
      `첫 값 ${format(numeric[0].value).text}, 마지막 값 ${
        format(numeric[numeric.length - 1].value).text
      }. 정확한 값은 시계열 데이터 표에서 확인하세요.`
    : '';
  const exactSummary = numeric.length
    ? `첫 정확한 값 ${format(numeric[0].value).exactText}, 마지막 정확한 값 ${
        format(numeric[numeric.length - 1].value).exactText
      }`
    : '';
  const pointerTime = (event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
    if (interactive ? timeSelectionDisabled : !contributionPointer || contributionDisabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / 600, rect.height / 60);
    if (!scale) return;
    const x = (event.clientX - rect.left - (rect.width - 600 * scale) / 2) / scale;
    const start = axisStart,
      span = axisEnd - axisStart;
    const visible = (interactive ? selectable : points).filter(
      point => metricNumericText(point.value) !== null && Number.isFinite(Number(point.value)),
    );
    const nearest = visible.reduce<typeof active | undefined>((best, point) => {
      const distance = (p: typeof point) => Math.abs((span ? 4 + ((Date.parse(p.time) - start) / span) * 592 : 300) - x);
      return !best || distance(point) < distance(best) ? point : best;
    }, undefined);
    return nearest?.time;
  };
  const mutedNoteClassName = 'text-xs text-[#475569]';
  return (
    <div className="min-w-0 px-2.5 pb-1 [container-type:inline-size]">
      {comparison && (
        <PeriodComparison
          comparison={comparison}
          title={title}
          prefix={prefix}
          suffix={suffix}
          decimalPlaces={decimalPlaces}
          numberNotation={numberNotation}
        />
      )}
      {unavailable && <p className={mutedNoteClassName}>이 지표의 시계열을 표시할 수 없습니다. {unavailable}</p>}
      {!numeric.length && !overlay?.previous.dots.length && !contributionInteractive ? (
        !unavailable && <p className={mutedNoteClassName}>표시할 시계열 데이터가 없습니다.</p>
      ) : (
        <>
          <figure className="m-0">
            <svg
              viewBox="0 0 600 60"
              width="100%"
              height="60"
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
              role={navigable ? 'group' : 'img'}
              tabIndex={navigable ? 0 : undefined}
              aria-disabled={
                (navigable &&
                  (!interactive || timeSelectionDisabled) &&
                  (!contributionInteractive || contributionDisabled)) ||
                undefined
              }
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-desc ${id}-exact${interactive ? ` ${id}-selection` : ''}${
                contributionInteractive ? ` ${id}-contribution` : ''
              }`}
              style={{
                cursor: interactive || contributionPointer ? 'pointer' : undefined,
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerMove={event => {
                const time = pointerTime(event);
                if (time) setActiveTime(time);
              }}
              onClick={event => {
                const time = pointerTime(event);
                if (time) {
                  if (interactive) select(time);
                  else setActiveTime(time);
                }
              }}
              onKeyDown={event => {
                if (!navigable || (!contributionInteractive && timeSelectionDisabled)) return;
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  let index = navigationPoints.findIndex(point => point.time === active?.time);
                  index =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                      ? navigationPoints.length - 1
                      : Math.max(0, Math.min(navigationPoints.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
                  setActiveTime(navigationPoints[index].time);
                } else if (interactive && (event.key === 'Enter' || event.key === ' ') && active) {
                  event.preventDefault();
                  select(active.time);
                }
              }}
            >
              <title id={`${id}-title`}>
                {title} {grain} 추세
              </title>
              <desc id={`${id}-desc`}>{summary} 세로축은 0을 포함합니다. 값 없음으로 기록된 구간은 연결하지 않습니다.</desc>
              <desc id={`${id}-exact`}>{exactSummary}</desc>
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.015" />
                </linearGradient>
              </defs>
              {overlay && (
                <>
                  <path
                    d={overlay.previous.path}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  {overlay.previous.dots.length > 0 &&
                    overlay.previous.dots.map((dot, index) => (
                      <circle key={index} cx={dot.x} cy={dot.y} r="3" fill="#64748b" />
                    ))}
                </>
              )}
              <path d={area} fill={`url(#${id}-fill)`} />
              <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
              {navigable &&
                active &&
                (() => {
                  const first = axisStart,
                    span = axisEnd - axisStart;
                  const x = span ? 4 + ((Date.parse(active.time) - first) / span) * 592 : 300;
                  return <line x1={x} x2={x} y1={4} y2={56} stroke="#1d4ed8" strokeDasharray="3 3" pointerEvents="none" />;
                })()}
              {(overlay || numeric.length === 1) &&
                dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="3" fill="#1d4ed8" />)}
            </svg>
            <figcaption className="flex justify-between gap-1 text-[11px] text-[#475569] @max-[360px]:grid @max-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @max-[360px]:gap-x-1 @max-[360px]:gap-y-px">
              <span className="whitespace-nowrap @max-[360px]:whitespace-normal @max-[360px]:[overflow-wrap:anywhere]">
                {overlay ? day(periods.current.start) : label(points[0].time)}
              </span>
              <span className="whitespace-nowrap @max-[360px]:col-span-full @max-[360px]:row-start-2 @max-[360px]:text-center @max-[360px]:whitespace-normal @max-[360px]:[overflow-wrap:anywhere]">
                {grain} · {overlay ? 'UTC' : zone}
              </span>
              <span className="whitespace-nowrap @max-[360px]:text-right @max-[360px]:whitespace-normal @max-[360px]:[overflow-wrap:anywhere]">
                {overlay ? day(periods.current.end) : label(points[points.length - 1].time)}
              </span>
            </figcaption>
          </figure>
        </>
      )}
      {overlay && (
        <p className="text-xs text-[#475569] [overflow-wrap:anywhere]">
          실선: 현재 기간 · 점선: 이전 기간 ({periods.previous.start} ~ {periods.previous.end}, UTC). 각 기간 시작일부터 같은
          일차를 비교합니다. 정확한 날짜·값과 이전 원본 조회는 아래 개별 표에서 확인하세요.
        </p>
      )}
      {previousTrend && periods && !overlay && (
        <p className={mutedNoteClassName}>
          겹쳐 보기는 같은 길이의 UTC 일별 기간에서 지원합니다. 이전 기간은 개별 추세와 표에서 확인하세요.
        </p>
      )}
      {trend?.timeSelectionUnavailable && <p className={mutedNoteClassName}>{trend.timeSelectionUnavailable}</p>}
      {interactive && (
        <p id={`${id}-selection`} aria-live="polite" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          시점을 눌러 기간 필터링 · ← → 이동, Enter/Space 선택. {activeRange && timeRangeLabel(activeRange)}
        </p>
      )}
      {contributionInteractive && active && (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <p id={`${id}-contribution`} aria-live="polite" className="min-w-0 text-xs [overflow-wrap:anywhere]">
            집계 원본 시점: {pointLabel(active.time)} ·{' '}
            <span title={format(active.value).exactText} aria-label={format(active.value).exactText}>
              {format(active.value).text}
            </span>
            . ← → / Home / End 이동
          </p>
          {contributionButton(active.time)}
        </div>
      )}
      {onContributionSelect && contributionReason && (!contributionInteractive || contributionDisabled) && (
        <p id={`${id}-contribution-reason`} className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {contributionReason}
        </p>
      )}
      <details className="mt-0.5 text-xs text-[#1d4ed8]">
        <summary className="w-fit cursor-pointer" aria-label={`${title} 시계열 데이터 표`}>
          시계열 데이터 표
        </summary>
        <div
          role="region"
          aria-label={`${title} 날짜별 값`}
          tabIndex={0}
          className="mt-1 max-h-[160px] overflow-auto text-[#14243c]"
        >
          <Table className="w-full border-collapse">
            <TableCaption className="caption-top text-left">
              {title} · {grain} · {zone}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="h-auto py-0.5 text-left">
                  날짜
                </TableHead>
                <TableHead scope="col" className="h-auto py-0.5 text-left">
                  값
                </TableHead>
                {contributionInteractive && (
                  <TableHead scope="col" className="h-auto py-0.5 text-left">
                    집계 원본 행
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map(point => {
                const range = rangeFor(point.time);
                return (
                  <TableRow key={point.time}>
                    <TableHead scope="row" className="h-auto py-0.5 text-left">
                      {onTimeSelect && range ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 text-left whitespace-normal"
                          aria-label={`기간 선택: ${timeRangeLabel(range)}`}
                          aria-pressed={sameTimeRange(selectedTimeRange, range)}
                          aria-disabled={timeSelectionDisabled || undefined}
                          onClick={() => select(point.time)}
                        >
                          {label(point.time)}
                        </Button>
                      ) : (
                        label(point.time)
                      )}
                    </TableHead>
                    <TableCell
                      className="py-0.5 text-left"
                      title={format(point.value).exactText}
                      aria-label={format(point.value).exactText}
                    >
                      {format(point.value).fullText}
                    </TableCell>
                    {contributionInteractive && (
                      <TableCell className="py-0.5 text-left">{contributionButton(point.time)}</TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
