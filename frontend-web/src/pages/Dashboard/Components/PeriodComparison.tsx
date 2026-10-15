import React, { useId } from 'react';
import { bignumber } from 'mathjs';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    <section aria-label={`${title} 이전 기간 비교`} className="mb-1.5 min-w-0">
      <h3 className="text-[13px] font-semibold">이전 기간 비교</h3>
      {comparison.unavailable && <Notice severity="warning">{comparison.unavailable}</Notice>}
      <dl className="m-0 grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div>
          <dt className="text-xs text-muted-foreground">이전 기간 값</dt>
          <dd className="m-0 text-sm [overflow-wrap:anywhere]" title={previous.exactText} aria-label={previous.exactText}>
            {previous.text}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">증감</dt>
          <dd className="m-0 text-sm [overflow-wrap:anywhere]" title={delta.exactText} aria-label={delta.exactText}>
            {delta.text}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">증감률</dt>
          <dd className="m-0 text-sm [overflow-wrap:anywhere]">{percent}</dd>
        </div>
      </dl>
      {zeroBaseline && <p className="text-xs text-muted-foreground">이전 기간 값이 0이므로 증감률은 계산할 수 없습니다.</p>}
    </section>
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
  const cellClassName = 'border-b border-border p-1 text-left font-normal whitespace-normal [overflow-wrap:anywhere]';
  return (
    <div className="min-w-0 p-4">
      {unavailable ? (
        <Notice severity="warning">이전 기간 결과를 표시할 수 없습니다. {unavailable}</Notice>
      ) : (
        <details className="text-[13px]">
          <summary
            className="flex min-h-11 cursor-pointer list-item items-center"
            aria-label={`${title} 이전 기간 데이터 표`}
          >
            이전 기간 데이터 표
          </summary>
          <p className="text-xs text-muted-foreground">
            원래 집계식과 동일한 필터로 조회한 결과입니다. 없는 날짜를 0으로 채우지 않습니다.
          </p>
          {onContributionSelect && contributionDisabled && contributionDisabledReason && (
            <p id={`${id}-contribution-reason`} className="text-xs [overflow-wrap:anywhere]">
              {contributionDisabledReason}
            </p>
          )}
          <div
            role="region"
            aria-label={`${title} 이전 기간 값`}
            tabIndex={0}
            className="mt-1 max-h-[180px] max-w-full overflow-auto"
          >
            <Table className="w-full border-collapse">
              <TableCaption className="caption-top text-left">
                {title} · 이전 기간{period ? ` · ${period}` : ''} · UTC
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className={cellClassName}>
                    {categoryField}
                  </TableHead>
                  <TableHead scope="col" className={cellClassName}>
                    {valueField}
                  </TableHead>
                  {onContributionSelect && (
                    <TableHead scope="col" className={cellClassName}>
                      집계 원본 행
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row, index) => (
                  <TableRow
                    key={
                      onContributionSelect && canContribute(row)
                        ? JSON.stringify([typeof row[categoryField], row[categoryField], index])
                        : index
                    }
                  >
                    <TableHead scope="row" className={cellClassName}>
                      {text(row[categoryField])}
                    </TableHead>
                    <TableCell className={cellClassName}>{text(row[valueField])}</TableCell>
                    {onContributionSelect && (
                      <TableCell className={cellClassName}>
                        {canContribute(row) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11 whitespace-normal text-left [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                            aria-label={`이전 기간 시점 원본 행 보기: ${title} · ${categoryLabel(row[categoryField])}`}
                            aria-disabled={contributionDisabled || undefined}
                            aria-describedby={
                              contributionDisabled && contributionDisabledReason ? `${id}-contribution-reason` : undefined
                            }
                            onClick={() => {
                              if (!contributionDisabled && canContribute(row)) onContributionSelect(row[categoryField]);
                            }}
                          >
                            이전 기간 시점 원본 행 보기
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!data?.length && <p className="text-sm">이전 기간 데이터가 없습니다.</p>}
        </details>
      )}
    </div>
  );
}
