import React, { useEffect, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { Button } from '@/components/ui/button';
import { GripVertical, SlidersHorizontal } from 'lucide-react';
import { formatMetric } from '@/utils/formatMetric';
import MetricTrend from '../Components/MetricTrend';
import { STUDIO_COLUMNS, StudioBlock, StudioBreakpoint, StudioDocumentV1, StudioOperation } from './studioTypes';
import { studioSampleTrend } from './studioSample';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
export const STUDIO_ROW_HEIGHT = 48;
export const STUDIO_ROW_MARGIN = 14;
/** Pixel height of one grid item. The live renderer fits this box instead of assuming a default size. */
export const studioItemHeight = (h: number) => STUDIO_ROW_HEIGHT * h + STUDIO_ROW_MARGIN * Math.max(0, h - 1);
/** A saved short row keeps its height: this only lowers the resize floor, it never grows the row. */
export const studioMinimumHeight = (kind: StudioBlock['kind'], h: number) => Math.min(h, kind === 'BOARD_NUMERIC' ? 5 : 6);
type Props = {
  readOnly?: boolean;
  document: StudioDocumentV1;
  breakpoint: StudioBreakpoint;
  selectedBlockId: string | null;
  onOperation: (operation: StudioOperation) => void;
  onSelect: (id: string | null) => void;
  onSettings: (id: string) => void;
  /** Actual aggregated renderer for the product route. The design preview leaves it undefined. */
  renderBlock?: (block: StudioBlock) => React.ReactNode;
};
export default function StudioCanvas({
  document,
  breakpoint,
  selectedBlockId,
  onOperation,
  onSelect,
  onSettings,
  renderBlock,
  readOnly = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const ordered = [...document.layouts[breakpoint]].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div
      ref={ref}
      className="studio-edit-grid"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onSelect(null);
        }
      }}
    >
      {!document.blocks.length ? (
        <div className="studio-empty">
          <h3>첫 블록을 추가해 보세요</h3>
          <p>상단의 블록 추가에서 지표나 차트를 선택하세요. 되돌리기로 삭제한 블록을 복원할 수도 있습니다.</p>
        </div>
      ) : (
        width > 0 && (
          <GridLayout
            key={breakpoint}
            width={width}
            cols={STUDIO_COLUMNS[breakpoint]}
            rowHeight={STUDIO_ROW_HEIGHT}
            margin={[STUDIO_ROW_MARGIN, STUDIO_ROW_MARGIN]}
            containerPadding={[0, 0]}
            compactType={null}
            preventCollision
            draggableHandle=".studio-drag-handle"
            isDraggable={!readOnly && breakpoint !== 'xs'}
            isResizable={!readOnly}
            layout={ordered.map(g => ({
              i: g.id,
              x: g.x,
              y: g.y,
              w: g.w,
              h: g.h,
              minW: breakpoint === 'xs' ? 1 : Math.min(3, g.w),
              minH: studioMinimumHeight(document.blocks.find(b => b.id === g.id)?.kind ?? 'CHART_LINE', g.h),
            }))}
            onDragStop={(_, old, item) => {
              if (readOnly) return;
              onSelect(item.i);
              if (old.x !== item.x || old.y !== item.y)
                onOperation({ type: 'moveBlock', blockId: item.i, breakpoint, x: item.x, y: item.y });
            }}
            onResizeStop={(_, old, item) => {
              if (readOnly) return;
              onSelect(item.i);
              if (old.w !== item.w || old.h !== item.h)
                onOperation({ type: 'resizeBlock', blockId: item.i, breakpoint, w: item.w, h: item.h });
            }}
          >
            {ordered.map(g => {
              const block = document.blocks.find(b => b.id === g.id);
              if (!block) return null;
              const scale = block.definitionKey === 'refund' ? 0.04 : block.definitionKey === 'net' ? 0.96 : 1;
              const value = 48260000 * scale;
              const formatted = formatMetric(String(Math.round(value)), block.display);
              return (
                <section
                  key={block.id}
                  data-studio-block={block.id}
                  className={`studio-card studio-edit-card ${
                    block.kind === 'BOARD_NUMERIC' ? 'studio-kpi' : 'studio-timeseries'
                  } ${selectedBlockId === block.id ? 'studio-card-selected' : ''}`}
                  aria-label={`${block.title} 블록`}
                >
                  <div className="studio-card-label">
                    <button
                      type="button"
                      className="studio-drag-handle"
                      disabled={readOnly}
                      aria-label={`${block.title} 이동 핸들`}
                      aria-describedby="studio-move-help"
                      onFocus={() => onSelect(block.id)}
                      onKeyDown={e => {
                        const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                        if (!readOnly && offsets[e.key]) {
                          e.preventDefault();
                          const [dx, dy] = offsets[e.key];
                          onOperation({ type: 'moveBlock', blockId: block.id, breakpoint, x: g.x + dx, y: g.y + dy });
                        }
                      }}
                    >
                      <GripVertical size={20} aria-hidden="true" />
                    </button>
                    <h3>{block.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="studio-config-trigger"
                      disabled={readOnly}
                      aria-label={`${block.title} 설정`}
                      aria-pressed={selectedBlockId === block.id}
                      onClick={() => {
                        onSelect(block.id);
                        onSettings(block.id);
                      }}
                    >
                      <SlidersHorizontal aria-hidden="true" />
                    </Button>
                  </div>
                  {renderBlock ? (
                    <div className="studio-live-block">{renderBlock(block)}</div>
                  ) : block.kind === 'BOARD_NUMERIC' ? (
                    <>
                      <div className="studio-metric-value" title={formatted.fullText}>
                        {formatted.text}
                      </div>
                      <p>{block.description}</p>
                      <MetricTrend
                        title={block.title}
                        trend={studioSampleTrend(scale)}
                        prefix={block.display.prefix}
                        suffix={block.display.suffix}
                        decimalPlaces={block.display.decimalPlaces}
                        numberNotation={block.display.numberNotation}
                      />
                    </>
                  ) : block.kind === 'CHART_LINE' ? (
                    <>
                      <p>{block.description}</p>
                      <MetricTrend
                        title={block.title}
                        trend={studioSampleTrend(scale)}
                        prefix={block.display.prefix}
                        suffix={block.display.suffix}
                        decimalPlaces={block.display.decimalPlaces}
                        numberNotation={block.display.numberNotation}
                      />
                    </>
                  ) : (
                    <ul className="studio-sample-bars">
                      {[
                        ['자사몰', 60],
                        ['네이버', 25],
                        ['기타', 15],
                      ].map(([name, amount]) => (
                        <li key={name}>
                          <div>
                            <span>{name}</span>
                            <strong>
                              {formatMetric(String(Math.round((value * Number(amount)) / 100)), block.display).text}
                            </strong>
                          </div>
                          <div className="studio-bar-track">
                            <span style={{ width: `${amount}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </GridLayout>
        )
      )}
      {document.blocks.length > 0 && (
        <p id="studio-move-help" className="studio-canvas-footnote">
          핸들을 끌거나 방향키로 이동합니다. 겹치는 위치에는 이동할 수 없습니다. 모바일에서는 선택 후 순서·크기 버튼을
          사용하세요.
        </p>
      )}
    </div>
  );
}
