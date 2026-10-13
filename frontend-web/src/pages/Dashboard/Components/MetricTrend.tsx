import React, { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

import { MetricTrendData, trendGeometry } from './trendGeometry';
import type { DateRange } from './PersonalSavedViews';
import { validTimeRange, sameTimeRange, timeRangeLabel } from './timeSelection';
import PeriodComparison, { MetricComparisonData } from './PeriodComparison';

export default function MetricTrend({
  trend,
  title,
  prefix = '',
  decimalPlaces = 0,
  unavailable,
  comparison,
  suffix = '',
  onTimeSelect,
  timeSelectionDisabled = false,
  selectedTimeRange,
}: {
  trend?: MetricTrendData;
  title: string;
  prefix?: string;
  decimalPlaces?: number;
  unavailable?: string;
  comparison?: MetricComparisonData;
  suffix?: string;
  onTimeSelect?: (range: DateRange) => void;
  timeSelectionDisabled?: boolean;
  selectedTimeRange?: DateRange | null;
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
  const active = selectable.find(point => point.time === activeTime) || selectable[0];
  const activeRange = active ? rangeFor(active.time) : undefined;
  const select = (time: string) => {
    const range = rangeFor(time);
    if (range && !timeSelectionDisabled) {
      setActiveTime(time);
      onTimeSelect?.(range);
    }
  };
  const interactive = !!onTimeSelect && selectable.length > 0;
  const points = (trend?.points || []).filter(point => Number.isFinite(Date.parse(point.time)));
  const numeric = points.filter(point => point.value !== null && Number.isFinite(point.value));
  const format = (value: number | null) =>
    value === null || !Number.isFinite(value)
      ? '값 없음'
      : `${prefix}${value.toLocaleString('ko-KR', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        })}`;
  const day = (time: string) => time.slice(0, 10);
  const { path, area, dots } = trendGeometry(points);
  const grain =
    trend?.grain === 'hour' ? '시간별' : trend?.grain === 'month' ? '월별' : trend?.grain === 'week' ? '주별' : '일별';
  const summary = numeric.length
    ? `${title} ${grain} 추세, UTC ${day(points[0].time)}부터 ${day(points[points.length - 1].time)}까지. ` +
      `첫 값 ${format(numeric[0].value)}, 마지막 값 ${format(
        numeric[numeric.length - 1].value,
      )}. 정확한 값은 시계열 데이터 표에서 확인하세요.`
    : '';
  const pointerTime = (event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || timeSelectionDisabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / 600, rect.height / 60);
    if (!scale) return;
    const x = (event.clientX - rect.left - (rect.width - 600 * scale) / 2) / scale;
    const times = points.map(point => Date.parse(point.time));
    const start = Math.min(...times),
      span = Math.max(...times) - start;
    const visible = selectable.filter(point => point.value !== null && Number.isFinite(point.value));
    const nearest = visible.reduce<typeof active | undefined>((best, point) => {
      const distance = (p: typeof point) => Math.abs((span ? 4 + ((Date.parse(p.time) - start) / span) * 592 : 300) - x);
      return !best || distance(point) < distance(best) ? point : best;
    }, undefined);
    return nearest?.time;
  };
  return (
    <Box sx={{ px: 2.5, pb: 1, minWidth: 0 }}>
      {comparison && (
        <PeriodComparison
          comparison={comparison}
          title={title}
          prefix={prefix}
          suffix={suffix}
          decimalPlaces={decimalPlaces}
        />
      )}
      {unavailable && (
        <Typography sx={{ fontSize: 12, color: '#475569' }}>이 지표의 시계열을 표시할 수 없습니다. {unavailable}</Typography>
      )}
      {!numeric.length ? (
        !unavailable && <Typography sx={{ fontSize: 12, color: '#475569' }}>표시할 시계열 데이터가 없습니다.</Typography>
      ) : (
        <>
          <Box component="figure" sx={{ m: 0 }}>
            <svg
              viewBox="0 0 600 60"
              width="100%"
              height="60"
              role={interactive ? 'group' : 'img'}
              tabIndex={interactive ? 0 : undefined}
              aria-disabled={(interactive && timeSelectionDisabled) || undefined}
              aria-labelledby={`${id}-title`}
              aria-describedby={interactive ? `${id}-desc ${id}-selection` : `${id}-desc`}
              style={{ cursor: interactive ? 'pointer' : undefined, WebkitTapHighlightColor: 'transparent' }}
              onPointerMove={event => {
                const time = pointerTime(event);
                if (time) setActiveTime(time);
              }}
              onClick={event => {
                const time = pointerTime(event);
                if (time) select(time);
              }}
              onKeyDown={event => {
                if (!interactive || timeSelectionDisabled) return;
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  let index = selectable.findIndex(point => point.time === active?.time);
                  index =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                      ? selectable.length - 1
                      : Math.max(0, Math.min(selectable.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
                  setActiveTime(selectable[index].time);
                } else if ((event.key === 'Enter' || event.key === ' ') && active) {
                  event.preventDefault();
                  select(active.time);
                }
              }}
            >
              <title id={`${id}-title`}>
                {title} {grain} 추세
              </title>
              <desc id={`${id}-desc`}>{summary} 세로축은 0을 포함합니다. 값 없음으로 기록된 구간은 연결하지 않습니다.</desc>
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.015" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${id}-fill)`} />
              <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
              {interactive &&
                active &&
                (() => {
                  const dates = points.map(point => Date.parse(point.time));
                  const first = Math.min(...dates),
                    span = Math.max(...dates) - first;
                  const x = span ? 4 + ((Date.parse(active.time) - first) / span) * 592 : 300;
                  return <line x1={x} x2={x} y1={4} y2={56} stroke="#1d4ed8" strokeDasharray="3 3" pointerEvents="none" />;
                })()}
              {numeric.length === 1 &&
                dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="3" fill="#1d4ed8" />)}
            </svg>
            <Box
              component="figcaption"
              sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}
            >
              <span>{day(points[0].time)}</span>
              <span>{grain} · UTC</span>
              <span>{day(points[points.length - 1].time)}</span>
            </Box>
          </Box>
        </>
      )}
      {interactive && (
        <Typography
          id={`${id}-selection`}
          aria-live="polite"
          sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          시점을 눌러 기간 필터링 · ← → 이동, Enter/Space 선택. {activeRange && timeRangeLabel(activeRange)}
        </Typography>
      )}
      <Box
        component="details"
        sx={{ mt: 0.5, fontSize: 12, color: '#1d4ed8', '& summary': { cursor: 'pointer', width: 'fit-content' } }}
      >
        <summary aria-label={`${title} 시계열 데이터 표`}>시계열 데이터 표</summary>
        <Box
          role="region"
          aria-label={`${title} 날짜별 값`}
          tabIndex={0}
          sx={{
            maxHeight: 160,
            overflow: 'auto',
            mt: 1,
            color: '#14243c',
            '& table': { width: '100%', borderCollapse: 'collapse' },
            '& th, & td': { textAlign: 'left', py: 0.5 },
          }}
        >
          <table>
            <caption>
              {title} · {grain} · UTC
            </caption>
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">값</th>
              </tr>
            </thead>
            <tbody>
              {points.map(point => {
                const range = rangeFor(point.time);
                return (
                  <tr key={point.time}>
                    <th scope="row">
                      {onTimeSelect && range ? (
                        <Button
                          type="button"
                          size="small"
                          aria-label={`기간 선택: ${timeRangeLabel(range)}`}
                          aria-pressed={sameTimeRange(selectedTimeRange, range)}
                          aria-disabled={timeSelectionDisabled || undefined}
                          sx={{ minWidth: 44, minHeight: 44, textTransform: 'none', textAlign: 'left' }}
                          onClick={() => select(point.time)}
                        >
                          {trend?.grain === 'hour' ? point.time.slice(0, 16).replace('T', ' ') : day(point.time)}
                        </Button>
                      ) : trend?.grain === 'hour' ? (
                        point.time.slice(0, 16).replace('T', ' ')
                      ) : (
                        day(point.time)
                      )}
                    </th>
                    <td>{format(point.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    </Box>
  );
}
