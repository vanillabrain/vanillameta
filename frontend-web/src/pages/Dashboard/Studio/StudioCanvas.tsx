import React, { useEffect, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { Button } from '@mui/material';
import DragIndicator from '@mui/icons-material/DragIndicator';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { formatMetric } from '@/utils/formatMetric';
import MetricTrend from '../Components/MetricTrend';
import { STUDIO_COLUMNS, StudioBreakpoint, StudioDocumentV1, StudioOperation } from './studioTypes';
import { studioSampleTrend } from './studioSample';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
type Props = {
  document: StudioDocumentV1;
  breakpoint: StudioBreakpoint;
  selectedBlockId: string | null;
  onOperation: (operation: StudioOperation) => void;
  onSelect: (id: string | null) => void;
  onSettings: (id: string) => void;
};
export default function StudioCanvas({ document, breakpoint, selectedBlockId, onOperation, onSelect, onSettings }: Props) {
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
            rowHeight={48}
            margin={[14, 14]}
            containerPadding={[0, 0]}
            compactType={null}
            preventCollision
            draggableHandle=".studio-drag-handle"
            isDraggable={breakpoint !== 'xs'}
            layout={ordered.map(g => ({
              i: g.id,
              x: g.x,
              y: g.y,
              w: g.w,
              h: g.h,
              minW: breakpoint === 'xs' ? 1 : Math.min(3, g.w),
              minH: document.blocks.find(b => b.id === g.id)?.kind === 'BOARD_NUMERIC' ? 5 : 6,
            }))}
            onDragStop={(_, old, item) => {
              onSelect(item.i);
              if (old.x !== item.x || old.y !== item.y)
                onOperation({ type: 'moveBlock', blockId: item.i, breakpoint, x: item.x, y: item.y });
            }}
            onResizeStop={(_, old, item) => {
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
                      aria-label={`${block.title} 이동 핸들`}
                      aria-describedby="studio-move-help"
                      onFocus={() => onSelect(block.id)}
                      onKeyDown={e => {
                        const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                        if (offsets[e.key]) {
                          e.preventDefault();
                          const [dx, dy] = offsets[e.key];
                          onOperation({ type: 'moveBlock', blockId: block.id, breakpoint, x: g.x + dx, y: g.y + dy });
                        }
                      }}
                    >
                      <DragIndicator fontSize="small" />
                    </button>
                    <h3>{block.title}</h3>
                    <Button
                      className="studio-config-trigger"
                      aria-label={`${block.title} 설정`}
                      aria-pressed={selectedBlockId === block.id}
                      onClick={() => {
                        onSelect(block.id);
                        onSettings(block.id);
                      }}
                    >
                      <TuneOutlined fontSize="small" />
                    </Button>
                  </div>
                  {block.kind === 'BOARD_NUMERIC' ? (
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
