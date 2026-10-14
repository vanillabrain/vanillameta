import React, { useId } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { bignumber } from 'mathjs';
import { formatMetric, metricNumericText, NumberNotation } from '@/utils/formatMetric';

export type MetricComparisonData = {
  previousValue: number | string | null;
  delta: number | string | null;
  percentChange: number | string | null;
  unavailable?: string;
};

export default function PeriodComparison({
  comparison,
  title,
  prefix = '',
  suffix = '',
  decimalPlaces = 0,
  numberNotation = 'full',
}: {
  comparison: MetricComparisonData;
  title: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  numberNotation?: NumberNotation;
}) {
  const format = (value: unknown, signed = false) =>
    formatMetric(value, { prefix, suffix, decimalPlaces, numberNotation, signed });
  const zeroBaseline =
    metricNumericText(comparison.previousValue) !== null && bignumber(metricNumericText(comparison.previousValue)).isZero();
  const percent = zeroBaseline
    ? '계산 불가'
    : formatMetric(comparison.percentChange, {
        decimalPlaces: 2,
        suffix: '%',
        signed: true,
        trimTrailingZeros: true,
      }).text;
  const previous = format(comparison.previousValue);
  const delta = format(comparison.delta, true);
  return (
    <Box component="section" aria-label={`${title} 이전 기간 비교`} sx={{ mb: 1.5, minWidth: 0 }}>
      <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600 }}>
        이전 기간 비교
      </Typography>
      {comparison.unavailable && <Alert severity="warning">{comparison.unavailable}</Alert>}
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
          '& dt': { fontSize: 12, color: 'text.secondary' },
          '& dd': { m: 0, fontSize: 14, overflowWrap: 'anywhere' },
        }}
      >
        <div>
          <dt>이전 기간 값</dt>
          <dd title={previous.exactText} aria-label={previous.exactText}>
            {previous.text}
          </dd>
        </div>
        <div>
          <dt>증감</dt>
          <dd title={delta.exactText} aria-label={delta.exactText}>
            {delta.text}
          </dd>
        </div>
        <div>
          <dt>증감률</dt>
          <dd>{percent}</dd>
        </div>
      </Box>
      {zeroBaseline && <Typography variant="caption">이전 기간 값이 0이므로 증감률은 계산할 수 없습니다.</Typography>}
    </Box>
  );
}

export function PreviousPeriodData({
  title,
  data,
  categoryField,
  valueField,
  period,
  unavailable,
  onContributionSelect,
  contributionDisabled = false,
  contributionDisabledReason,
}: {
  title: string;
  data?: Record<string, unknown>[];
  categoryField: string;
  valueField: string;
  period?: string;
  unavailable?: string;
  onContributionSelect?: (category: unknown) => void;
  contributionDisabled?: boolean;
  contributionDisabledReason?: string;
}) {
  const id = useId();
  const canContribute = (row: Record<string, unknown>) => {
    const category = row[categoryField];
    return (
      Object.prototype.hasOwnProperty.call(row, categoryField) &&
      (category === null ||
        typeof category === 'boolean' ||
        (typeof category === 'string' && category.length <= 2000) ||
        (typeof category === 'number' && Number.isFinite(category)))
    );
  };
  const categoryLabel = (category: unknown) =>
    category === null
      ? '값 없음 (NULL)'
      : `${String(category)} (${
          typeof category === 'number' ? '숫자' : typeof category === 'boolean' ? '불리언' : '문자열'
        })`;
  const text = (value: unknown) =>
    value === null || value === undefined ? '값 없음' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return (
    <Box sx={{ p: 2, minWidth: 0 }}>
      {unavailable ? (
        <Alert severity="warning">이전 기간 결과를 표시할 수 없습니다. {unavailable}</Alert>
      ) : (
        <Box
          component="details"
          sx={{
            fontSize: 13,
            '& summary': { cursor: 'pointer', minHeight: 44, display: 'list-item', alignContent: 'center' },
          }}
        >
          <summary aria-label={`${title} 이전 기간 데이터 표`}>이전 기간 데이터 표</summary>
          <Typography variant="caption">
            원래 집계식과 동일한 필터로 조회한 결과입니다. 없는 날짜를 0으로 채우지 않습니다.
          </Typography>
          {onContributionSelect && contributionDisabled && contributionDisabledReason && (
            <Typography id={`${id}-contribution-reason`} sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
              {contributionDisabledReason}
            </Typography>
          )}
          <Box
            role="region"
            aria-label={`${title} 이전 기간 값`}
            tabIndex={0}
            sx={{
              mt: 1,
              maxHeight: 180,
              overflow: 'auto',
              maxWidth: '100%',
              '& table': { width: '100%', borderCollapse: 'collapse' },
              '& th, & td': { textAlign: 'left', p: 0.5, overflowWrap: 'anywhere', borderBottom: 1, borderColor: 'divider' },
            }}
          >
            <table>
              <caption>
                {title} · 이전 기간{period ? ` · ${period}` : ''} · UTC
              </caption>
              <thead>
                <tr>
                  <th scope="col">{categoryField}</th>
                  <th scope="col">{valueField}</th>
                  {onContributionSelect && <th scope="col">집계 원본 행</th>}
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row, index) => (
                  <tr
                    key={
                      onContributionSelect && canContribute(row)
                        ? JSON.stringify([typeof row[categoryField], row[categoryField], index])
                        : index
                    }
                  >
                    <th scope="row">{text(row[categoryField])}</th>
                    <td>{text(row[valueField])}</td>
                    {onContributionSelect && (
                      <td>
                        {canContribute(row) && (
                          <Button
                            type="button"
                            size="small"
                            aria-label={`이전 기간 시점 원본 행 보기: ${title} · ${categoryLabel(row[categoryField])}`}
                            aria-disabled={contributionDisabled || undefined}
                            aria-describedby={
                              contributionDisabled && contributionDisabledReason ? `${id}-contribution-reason` : undefined
                            }
                            sx={{
                              minWidth: 44,
                              minHeight: 44,
                              textTransform: 'none',
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              textAlign: 'left',
                              '&:focus-visible': { outline: '2px solid #1d4ed8', outlineOffset: 2 },
                            }}
                            onClick={() => {
                              if (!contributionDisabled && canContribute(row)) onContributionSelect(row[categoryField]);
                            }}
                          >
                            이전 기간 시점 원본 행 보기
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          {!data?.length && <Typography variant="body2">이전 기간 데이터가 없습니다.</Typography>}
        </Box>
      )}
    </Box>
  );
}
