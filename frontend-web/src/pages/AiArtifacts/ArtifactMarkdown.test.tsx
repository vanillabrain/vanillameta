import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ArtifactMarkdown } from './ArtifactMarkdown';

afterEach(cleanup);
it('renders Claude reports as a semantic table, quote and fenced code block', () => {
  render(<ArtifactMarkdown markdown={[
    '# 지역별 매출', '', '> 발표용 합성 데이터', '', '| 지역 | 만 원 |', '| --- | ---: |',
    '| 서울 | 120 |', '| 부산 | 100 |', '', '```text', '합계 = 220', '```',
  ].join('\n')} />);
  expect(screen.getByRole('heading', { name: '지역별 매출', level: 2 })).toBeTruthy();
  expect(screen.getByText('발표용 합성 데이터').closest('blockquote')).toBeTruthy();
  const table = screen.getByRole('table');
  expect(within(table).getByRole('columnheader', { name: '만 원' })).toBeTruthy();
  expect(within(table).getByRole('row', { name: '부산 100' })).toBeTruthy();
  expect(screen.getByText('합계 = 220').closest('pre')).toBeTruthy();
});

it('does not load external images or embed raw HTML when reading a document', () => {
  const { container } = render(<ArtifactMarkdown markdown={'![외부 도표](https://example.invalid/chart.png)\n\n<iframe src="https://example.invalid/report"></iframe>\n\n[참고 문서](https://example.com/guide)'} />);
  expect(container.querySelector('img,iframe')).toBeNull();
  expect(screen.getByText('외부 도표')).toBeTruthy();
  expect(screen.getByRole('link', { name: '참고 문서' }).getAttribute('rel')).toContain('noreferrer');
});
