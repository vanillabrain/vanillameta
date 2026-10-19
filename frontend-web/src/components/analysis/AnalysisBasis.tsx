import React, { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export type AnalysisBasisValue = { data: string; period: string; filters: string; metrics: string };
type Props = AnalysisBasisValue & {
  status: string;
  note?: string;
  details?: Array<{ label: string; value: string }>;
  className?: string;
};
/** A read-only projection of this surface's own basis. Never fetches or propagates analysis state. */
export default function AnalysisBasis({ status, note, details = [], className, ...basis }: Props) {
  const heading = useId();
  const fields = [
    ['data', '데이터'],
    ['period', '기간'],
    ['filters', '필터'],
    ['metrics', '지표 기준'],
  ] as const;
  return (
    <section
      aria-labelledby={heading}
      className={cn('@container/analysis-basis min-w-0 rounded-lg border bg-card text-card-foreground', className)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-4 pt-3">
        <div id={heading} role="heading" aria-level={2} className="text-sm font-semibold">
          분석 기준
        </div>
        <Badge variant="secondary" className="max-w-full whitespace-normal [overflow-wrap:anywhere]">
          {status}
        </Badge>
      </div>
      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 p-4 @3xl/analysis-basis:grid-cols-4">
        {fields.map(([key, label]) => (
          <div key={key} className="min-w-0">
            <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
            <dd className="line-clamp-2 text-sm leading-5 [overflow-wrap:anywhere]">{basis[key]}</dd>
          </div>
        ))}
      </dl>
      <details className="group/analysis-basis min-w-0 border-t px-4">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm py-1.5 text-sm leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:min-h-8">
          기준 자세히 보기
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/analysis-basis:rotate-180" />
        </summary>
        <dl className="min-w-0 space-y-3 pb-4 text-sm leading-5 [overflow-wrap:anywhere]">
          {[...fields.map(([key, label]) => ({ label, value: basis[key] })), ...details].map((item, index) => (
            <div key={index} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{item.value}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="min-w-0 pb-4 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{note}</p>}
      </details>
    </section>
  );
}

/** Preserve typed filter values and all selected values in the expandable basis, without guessing defaults. */
export function analysisFilterBasis(
  filters: Array<{ column: string; values?: unknown[]; range?: { min?: number; max?: number } }> = [],
  conditions = false,
) {
  const parts = filters.map(
    filter =>
      `${filter.column}: ${
        filter.values
          ? filter.values.map(value => JSON.stringify(value)).join(', ')
          : filter.range
          ? `${filter.range.min ?? '−∞'} ~ ${filter.range.max ?? '+∞'}`
          : '조건 확인 필요'
      }`,
  );
  if (conditions) parts.push('포함·제외 조건 적용됨');
  return parts.length ? parts.join(' · ') : '공통 필터 없음';
}
