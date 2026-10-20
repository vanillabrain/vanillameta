import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { StudioPivotRecipe, StudioPivotResult } from './studioPivot';
const operators = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=' };
const threshold = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 21 });
/** Read only the confirmed block recipe and its preview metadata, never the live metric catalog. */
export default function StudioPivotConditions({ recipe, result }: { recipe: StudioPivotRecipe; result: StudioPivotResult }) {
  const segment = recipe.state.segment;
  if (!segment) return null;
  return (
    <div className="min-w-0 space-y-2 pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="secondary">이 블록에 적용</Badge>
        <p className="min-w-0 break-words text-xs text-muted-foreground">
          {result.scope.dimensionColumn}별 · 모든 조건 충족 (AND)
        </p>
      </div>
      <ul aria-label="이 블록의 집계 조건" className="flex min-w-0 flex-wrap gap-2">
        {segment.conditions.map((condition, index) => {
          const metric = result.kpis.find(m => m.id === condition.measureId);
          const unit = metric?.unit.trim();
          return (
            <li
              key={index}
              className="min-w-0 max-w-full rounded-md border bg-background px-2 py-1 text-sm leading-5 [overflow-wrap:anywhere]"
            >
              <span>{metric?.label ?? `지표 #${condition.measureId}`}</span>{' '}
              <span className="tabular-nums">
                {operators[condition.operator]} {threshold.format(condition.value)}
                {unit === '%' ? '%' : unit ? ` ${unit}` : ''}
              </span>
              {!metric && <span className="ml-1 text-xs text-muted-foreground">(단위 확인 필요)</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
