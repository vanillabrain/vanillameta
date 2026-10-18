import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SegmentResult } from './AggregateSegment';
const category = (v: unknown) => (v === null ? '(값 없음)' : v === '' ? '(빈 문자열)' : String(v));
export type SegmentSelection = { row?: string | number | boolean | null; column?: string | number | boolean | null };
export default function SegmentPivot({
  result,
  metricText,
  embedded = false,
  onSelect,
}: {
  result: SegmentResult;
  embedded?: boolean;
  onSelect?: (selection: SegmentSelection, trigger: HTMLButtonElement) => void;
  metricText: (metric: SegmentResult['kpis'][number], value: unknown) => string;
}) {
  const pivot = result.pivot;
  if (!pivot) return null;
  const values = (entries: Array<{ id: number; value: unknown }> | undefined) =>
    result.kpis.map(m => (
      <div key={m.id} className="whitespace-nowrap">
        <span className="mr-2 text-xs font-normal text-muted-foreground">{m.label}</span>
        {metricText(m, entries?.find(v => v.id === m.id)?.value)}
      </div>
    ));
  const content = (entries: Array<{ id: number; value: unknown }> | undefined, selection: SegmentSelection, label: string) =>
    onSelect ? (
      <Button
        variant="ghost"
        className="h-auto min-h-9 w-full flex-col items-end gap-0 px-1 py-2 text-right tabular-nums"
        aria-label={`${label} · 기여 원본 보기`}
        onClick={event => onSelect(selection, event.currentTarget)}
      >
        {values(entries)}
      </Button>
    ) : (
      values(entries)
    );
  const Container = embedded ? 'div' : Card;
  return (
    <Container className={embedded ? 'flex min-w-0 flex-col gap-3' : 'min-w-0 gap-3 p-4'}>
      <h3 className="text-sm font-semibold">
        조건 대상 Pivot · {result.scope.dimensionColumn} × {pivot.column}
      </h3>
      <p className="text-xs text-muted-foreground">
        대상은 최대50개, 열은20개를 표시합니다. 행·열·전체 합계는 표시 상한 밖의 기여 행도 포함해 각각 다시 계산합니다.
        비율은 셀의 합이 아닙니다.{pivot.truncatedColumns ? ' · 일부 열 생략' : ''}
      </p>
      {onSelect && (
        <p className="text-xs text-muted-foreground">셀이나 합계를 선택하면 그 숫자에 기여한 원본 행을 확인합니다.</p>
      )}
      <p className="text-xs text-muted-foreground sm:hidden">
        표에 초점을 두고 ← →로 이동하세요. Home/End는 처음/마지막 열로 이동합니다.
      </p>
      <div
        role="region"
        aria-label="집계 조건 Pivot 표"
        tabIndex={0}
        onKeyDown={event => {
          const region = event.currentTarget;
          if (
            event.target !== region ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            region.scrollWidth <= region.clientWidth
          )
            return;
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const max = region.scrollWidth - region.clientWidth;
          region.scrollLeft =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
              ? max
              : Math.max(0, Math.min(max, region.scrollLeft + (event.key === 'ArrowRight' ? 80 : -80)));
        }}
        className="max-w-full overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <table className="w-full caption-bottom text-sm">
          <TableCaption>집계 조건을 통과한 대상의 교차 집계 · 표 안에서 가로 스크롤</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-36">
                {result.scope.dimensionColumn} / {pivot.column}
              </TableHead>
              {pivot.columns.map((c, i) => (
                <TableHead key={i} className="min-w-40 text-right whitespace-nowrap">
                  {category(c.value)}
                </TableHead>
              ))}
              <TableHead className="min-w-40 text-right">전체 합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pivot.rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="break-words whitespace-normal">{category(row.category)}</TableCell>
                {row.cells.map((cell, j) => (
                  <TableCell key={j} className="text-right tabular-nums">
                    {content(
                      cell.values,
                      { row: row.category as any, column: cell.column as any },
                      `${result.scope.dimensionColumn} ${category(row.category)} · ${pivot.column} ${category(cell.column)}`,
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">
                  {content(
                    result.groups.find(g => g.category === row.category)?.values,
                    { row: row.category as any },
                    `${result.scope.dimensionColumn} ${category(row.category)} · 행 합계`,
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>전체 합계</TableCell>
              {pivot.columns.map((c, i) => (
                <TableCell key={i} className="text-right tabular-nums">
                  {content(c.totals, { column: c.value as any }, `${pivot.column} ${category(c.value)} · 열 합계`)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{content(result.kpis, {}, '전체 합계')}</TableCell>
            </TableRow>
          </TableBody>
        </table>
      </div>
    </Container>
  );
}
