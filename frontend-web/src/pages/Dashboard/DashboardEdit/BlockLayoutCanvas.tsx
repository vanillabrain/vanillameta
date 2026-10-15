import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type Rect = { x: number; y: number; w: number; h: number };
type Mode = 'mobile' | 'tablet' | 'desktop';
type Block = { key: string; title: string; height: number; layouts?: Partial<Record<Mode, Rect>> };
const Grid = WidthProvider(GridLayout);
const columns = { mobile: 4, tablet: 8, desktop: 12 };
export function validLayout(rects: Rect[], cols: number) {
  return rects.every(
    (a, i) =>
      Object.values(a).every(Number.isSafeInteger) &&
      a.x >= 0 &&
      a.y >= 0 &&
      a.y <= 1000 &&
      a.w >= 1 &&
      a.x + a.w <= cols &&
      a.h >= 1 &&
      a.h <= 50 &&
      rects.slice(i + 1).every(b => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y),
  );
}
export default function BlockLayoutCanvas({
  items,
  mode,
  saved,
  disabled,
  onCommit,
  children,
}: {
  items: Block[];
  mode: Mode;
  saved?: Record<Mode, Record<string, Rect>>;
  disabled: boolean;
  onCommit: (rects: Record<string, Rect>) => void;
  children: React.ReactNode[];
}) {
  const [error, setError] = useState('');
  const [reset, setReset] = useState(0);
  const cols = columns[mode];
  let bottom = 0;
  const layout = items.map(item => {
    const rect = item.layouts?.[mode] ?? saved?.[mode]?.[item.key] ?? { x: 0, y: bottom, w: cols, h: item.height };
    bottom = Math.max(bottom, rect.y + rect.h);
    return { ...rect, i: item.key, minW: 1, minH: 1, maxW: cols, maxH: 50 };
  });
  const commit = (next: Array<Rect & { i: string }>) => {
    if (disabled) return;
    if (
      next.length !== items.length ||
      new Set(next.map(r => r.i)).size !== items.length ||
      items.some(item => !next.some(r => r.i === item.key)) ||
      !validLayout(
        next.map(({ x, y, w, h }) => ({ x, y, w, h })),
        cols,
      )
    ) {
      setReset(value => value + 1);
      setError('다른 블록과 겹치거나 화면 범위를 벗어나는 배치는 적용할 수 없습니다.');
      return;
    }
    setError('');
    const rects = Object.fromEntries(next.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]));
    if (layout.some(r => JSON.stringify(rects[r.i]) !== JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h }))) onCommit(rects);
  };
  return (
    <>
      <p className="text-xs">손잡이로 이동 · 모서리로 크기 조절 · 방향키 이동 / Shift+방향키 크기 조절</p>
      <p aria-live="polite" className="text-xs">
        {error}
      </p>
      <Grid
        key={`${mode}-${reset}`}
        layout={layout}
        cols={cols}
        rowHeight={80}
        margin={[8, 8]}
        containerPadding={[0, 0]}
        compactType={null}
        preventCollision
        isDraggable={!disabled}
        isResizable={!disabled}
        draggableHandle=".block-drag-handle"
        onDragStop={commit}
        onResizeStop={commit}
      >
        {items.map((item, index) => (
          <div key={item.key} className="overflow-hidden rounded border border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="block-drag-handle h-7 w-full cursor-grab touch-none justify-start overflow-hidden rounded-none bg-muted/40 px-2 text-left text-xs disabled:cursor-default"
              disabled={disabled}
              aria-label={`${item.title} 배치 이동`}
              onKeyDown={event => {
                const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
                if (!offset || disabled) return;
                event.preventDefault();
                commit(
                  layout.map(r =>
                    r.i !== item.key
                      ? r
                      : event.shiftKey
                      ? { ...r, w: r.w + offset[0], h: r.h + offset[1] }
                      : { ...r, x: r.x + offset[0], y: r.y + offset[1] },
                  ),
                );
              }}
            >
              ⠿ {item.title} · 이동
            </Button>
            <div className="h-[calc(100%-1.75rem)] overflow-auto">{children[index]}</div>
          </div>
        ))}
      </Grid>
    </>
  );
}
