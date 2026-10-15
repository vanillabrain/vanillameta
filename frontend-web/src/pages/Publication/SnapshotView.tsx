import React from 'react';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import MetricTrend from '../Dashboard/Components/MetricTrend';
import { analysisOptions } from '../Dashboard/analysisOptions';
import { responsiveBlockStyle } from '../Dashboard/responsiveBlockStyle';

export type Snapshot = {
  schemaVersion: 1;
  title: string;
  capturedAt: string;
  scope: string;
  widgets: any[];
  responsiveLayouts: any;
};

/** Saved per-width rects (600/900 px contract) drive CSS custom properties, not a style-object cast. */
type StyleWithVars = React.CSSProperties & Record<`--${string}`, string>;
const responsiveBlockClassName =
  '[grid-row:var(--block-row-xs)] [grid-column:var(--block-col-xs)]' +
  ' [@media(min-width:600px)_and_(max-width:899.98px)]:[grid-row:var(--block-row-sm)]' +
  ' [@media(min-width:600px)_and_(max-width:899.98px)]:[grid-column:var(--block-col-sm)]' +
  ' [@media(min-width:900px)]:[grid-row:var(--block-row-md)]' +
  ' [@media(min-width:900px)]:[grid-column:var(--block-col-md)]';

/** Public rendering consumes only captured data; it never queries a source or grants source access. */
export default function SnapshotView({
  snapshot,
  context = 'publication',
}: {
  snapshot: Snapshot;
  context?: 'publication' | 'reuse';
}) {
  const blockClassName = (blockId: string) => {
    const rects = responsiveBlockStyle(snapshot.responsiveLayouts, blockId);
    return rects.gridRow && rects.gridColumn ? responsiveBlockClassName : undefined;
  };
  const blockStyle = (blockId: string): StyleWithVars => {
    const rects = responsiveBlockStyle(snapshot.responsiveLayouts, blockId);
    if (!rects.gridRow || !rects.gridColumn) return {};
    return {
      '--block-row-xs': rects.gridRow.xs,
      '--block-row-sm': rects.gridRow.sm,
      '--block-row-md': rects.gridRow.md,
      '--block-col-xs': rects.gridColumn.xs,
      '--block-col-sm': rects.gridColumn.sm,
      '--block-col-md': rects.gridColumn.md,
    };
  };
  return (
    <section aria-label={context === 'reuse' ? '복사본 미리보기' : '게시 결과'} className="min-w-0">
      <h2 className="my-3 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">{snapshot.title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {snapshot.scope} · 집계 시점 {snapshot.capturedAt} · {context === 'reuse' ? '저장 전 미리보기' : '고정된 결과'}
      </p>
      <div className="grid min-w-0 auto-rows-[minmax(80px,auto)] grid-cols-[repeat(4,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(8,minmax(0,1fr))] md:grid-cols-[repeat(12,minmax(0,1fr))]">
        {snapshot.widgets.map(widget => (
          <Card
            key={widget.blockId}
            className={cn(
              'h-auto gap-0 overflow-hidden border border-border py-0 shadow-sm',
              widget.type === 'BOARD_NUMERIC' ? 'min-h-[300px]' : 'min-h-[320px]',
              blockClassName(widget.blockId),
            )}
            style={blockStyle(widget.blockId)}
          >
            <div className={cn('min-w-0', widget.type === 'BOARD_NUMERIC' ? 'h-[155px]' : 'h-[300px]')}>
              <WidgetViewer
                title={widget.title}
                description={widget.description}
                widgetType={widget.type}
                widgetOption={analysisOptions(widget)}
                dataSet={widget.datas}
              />
            </div>
            {widget.type === 'BOARD_NUMERIC' && (
              <MetricTrend
                title={widget.title}
                trend={widget.trend}
                unavailable={widget.trendUnavailable}
                prefix={widget.prefix}
                suffix={widget.suffix}
                decimalPlaces={widget.decimalPlaces ?? 0}
                numberNotation={widget.numberNotation || 'compact'}
              />
            )}
          </Card>
        ))}
      </div>
      <Notice severity="info" className="mt-4">
        {context === 'reuse'
          ? '새 데이터 소스의 미리보기입니다. 확인 후 복사본으로 저장하세요. 원본과 게시본은 바뀌지 않습니다.'
          : '게시 시점의 집계 결과입니다. 원본 데이터 갱신과 편집 내용은 재게시 후 반영됩니다.'}
      </Notice>
    </section>
  );
}
