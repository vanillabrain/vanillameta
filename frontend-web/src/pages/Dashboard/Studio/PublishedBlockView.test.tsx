import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PublishedBlockView } from './PublishedDashboard';
const state = vi.hoisted(() => ({ props: null as any, language: 'ko' }));
vi.mock('@/widget/modules/linechart/LineChart', () => ({
  default: (props: any) => {
    state.props = props;
    return <div>Line chart</div>;
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: state.language } }),
}));
afterEach(() => {
  cleanup();
  state.props = null;
  state.language = 'ko';
});
const block = (datas: any[]) =>
  ({ id: 'line', title: 'Daily', kind: 'CHART_LINE', valueField: 'value', categoryField: 'day', datas, display: {} } as any);
it('shows a visible point for a published single-date line without changing values', () => {
  const row = Object.freeze({ day: '2025-01-01', value: '13000.00' });
  render(<PublishedBlockView block={block([row])} />);
  expect(state.props.seriesOp).toMatchObject({ showSymbol: true, symbolSize: 7 });
  expect(state.props.dataSet).toEqual([row]);
});
it.each([
  { datas: [] },
  {
    datas: [
      { day: 'a', value: 1 },
      { day: 'b', value: 2 },
    ],
  },
])('retains the existing symbol-free presentation for $datas', ({ datas }) => {
  render(<PublishedBlockView block={block(datas)} />);
  expect(state.props.seriesOp.showSymbol).toBe(false);
});
it('displays Korean count units without mutating the publication and retains English units', () => {
  const b = { ...block([{ value: 2 }]), kind: 'BOARD_NUMERIC', display: Object.freeze({ suffix: ' count' }) };
  const view = render(<PublishedBlockView block={b} />);
  expect(screen.getByText('2건')).toBeTruthy();
  expect(b.display.suffix).toBe(' count');
  state.language = 'en';
  view.rerender(<PublishedBlockView block={b} />);
  expect(screen.getByText('2 count')).toBeTruthy();
});
