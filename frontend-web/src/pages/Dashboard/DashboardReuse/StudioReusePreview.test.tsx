import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioReusePreview from './StudioReusePreview';
import { mixedReusePreview } from './studioReusePreview.fixture';
vi.mock('../Studio/PublishedBlockView', () => ({ PublishedBlockView: ({ block }: any) => <h2>{block.title}</h2> }));
afterEach(cleanup);
it('candidate_pivot_and_chart_render_in_saved_order', () => {
  render(<StudioReusePreview preview={mixedReusePreview()} />);
  expect(screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual([
    'Sales 복사본 블록',
    'Margin 복사본 블록',
  ]);
  expect(screen.getByText(/새 지표 2개/)).toBeTruthy();
});
it('renders_long_labels_without_source_lookup', () => {
  const v = mixedReusePreview();
  v.blocks[1].title = '매우 긴 고객 매출과 서비스별 이익 기여 분석 '.repeat(5);
  render(<StudioReusePreview preview={v} />);
  expect(screen.getByRole('heading', { name: v.blocks[1].title.trim() })).toBeTruthy();
});
