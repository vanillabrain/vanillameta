import React, { useId } from 'react';
import { Box, Typography } from '@mui/material';

import { MetricTrendData, trendGeometry } from './trendGeometry';
import PeriodComparison, { MetricComparisonData } from './PeriodComparison';

export default function MetricTrend({
  trend,
  title,
  prefix = '',
  decimalPlaces = 0,
  unavailable,
  comparison,
  suffix = '',
}: {
  trend?: MetricTrendData;
  title: string;
  prefix?: string;
  decimalPlaces?: number;
  unavailable?: string;
  comparison?: MetricComparisonData;
  suffix?: string;
}) {
  const id = useId();
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
            <svg viewBox="0 0 600 60" width="100%" height="60" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
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
              {points.map((point, index) => (
                <tr key={index}>
                  <th scope="row">
                    {trend?.grain === 'hour' ? point.time.slice(0, 16).replace('T', ' ') : day(point.time)}
                  </th>
                  <td>{format(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>
    </Box>
  );
}
