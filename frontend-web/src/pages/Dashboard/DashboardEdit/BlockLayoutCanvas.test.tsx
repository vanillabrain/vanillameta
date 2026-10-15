import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Canvas, { validLayout } from './BlockLayoutCanvas';
vi.mock('@/components/analysis/AnalysisUi', () => ({
  ANALYSIS_UI: { fontSize: 12, controlHeight: 28, radius: 4, border: '#e2e8f0', surface: '#f8fafc' },
}));
const grid = vi.hoisted(() => ({ props: null as any }));
vi.mock('react-grid-layout', () => ({
  default: (props: any) => {
    grid.props = props;
    return <div>{props.children}</div>;
  },
  WidthProvider: (component: any) => component,
}));
afterEach(cleanup);
const items = [
  { key: 'a', title: '매출', height: 3, layouts: { desktop: { x: 0, y: 0, w: 4, h: 3 } } },
  { key: 'b', title: '환불', height: 3, layouts: { desktop: { x: 4, y: 0, w: 4, h: 3 } } },
];
it('commits only valid changed drag/resize stops, strips library extras and blocks busy edits', () => {
  const onCommit = vi.fn();
  const view = render(
    <Canvas items={items} mode="desktop" disabled={false} onCommit={onCommit}>
      {[<div key="a" />, <div key="b" />]}
    </Canvas>,
  );
  expect(onCommit).not.toHaveBeenCalled();
  expect(grid.props.onLayoutChange).toBeUndefined();
  grid.props.onDragStop(grid.props.layout);
  expect(onCommit).not.toHaveBeenCalled();
  grid.props.onDragStop(grid.props.layout.map((r: any) => (r.i === 'a' ? { ...r, y: 4 } : r)));
  expect(onCommit.mock.calls[0][0].a).toEqual({ x: 0, y: 4, w: 4, h: 3 });
  grid.props.onResizeStop(grid.props.layout.map((r: any) => (r.i === 'a' ? { ...r, h: 4 } : r)));
  expect(onCommit.mock.calls[1][0].a).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  grid.props.onResizeStop(grid.props.layout.map((r: any) => (r.i === 'a' ? { ...r, w: 5 } : r)));
  expect(onCommit).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(screen.getByRole('button', { name: '매출 배치 이동' }), { key: 'ArrowRight' });
  expect(onCommit).toHaveBeenCalledTimes(2);
  view.rerender(
    <Canvas items={items} mode="desktop" disabled onCommit={onCommit}>
      {[<div key="a" />, <div key="b" />]}
    </Canvas>,
  );
  grid.props.onResizeStop(grid.props.layout.map((r: any) => ({ ...r, y: r.y + 5 })));
  expect(onCommit).toHaveBeenCalledTimes(2);
  expect(grid.props.isDraggable).toBe(false);
});
it('rejects nonintegers, negative coordinates, oversize and overlap', () => {
  const rect = { x: 0, y: 0, w: 4, h: 3 };
  expect(validLayout([rect, { ...rect, x: 4 }], 8)).toBe(true);
  for (const changes of [{ x: -1 }, { y: 1001 }, { w: 9 }, { h: 51 }, { x: 0.5 }])
    expect(validLayout([{ ...rect, ...changes }], 8)).toBe(false);
  expect(validLayout([rect, { ...rect, x: 3 }], 8)).toBe(false);
});
