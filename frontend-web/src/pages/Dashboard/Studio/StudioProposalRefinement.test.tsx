import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioProposalRefinement from './StudioProposalRefinement';
import { CreationProposal, proposeStudio } from './studioCreation';

vi.mock('./studioCreation', async importOriginal => ({
  ...(await importOriginal<typeof import('./studioCreation')>()),
  proposeStudio: vi.fn(),
}));
vi.mock('@/hooks/useAiStatus', () => ({ useAiLabel: () => 'AI 호출 0/30' }));
afterEach(() => {
  cleanup();
});

const block = (title: string) => ({
  title,
  kind: 'CHART_COLUMN',
  metric: { aggregation: 'SUM', column: 'amount' },
  dimension: { column: 'channel', type: 'category', schemaVersion: '1' },
});
const proposal = (title: string, parent?: string): CreationProposal => ({
  proposalId: parent ? 'child' : 'parent',
  ...(parent ? { parentProposalId: parent } : {}),
  sourceId: 3,
  sourceRevision: 'a'.repeat(64),
  title: '분석',
  businessBasis: null,
  profile: { sourceId: 3, rowCount: '2', columns: [] },
  semanticProposal: [block(title)],
});

it('tells the user when only the title of the refined block changed', async () => {
  vi.mocked(proposeStudio).mockResolvedValue(proposal('지역별 매출', 'parent'));
  const onProposal = vi.fn();
  render(
    <StudioProposalRefinement
      proposal={proposal('채널별 매출')}
      disabled={false}
      onProposal={onProposal}
      onBusy={() => undefined}
    />,
  );
  fireEvent.change(screen.getByLabelText('생성안 수정 요청'), { target: { value: '제목을 지역별 매출로' } });
  fireEvent.click(screen.getByText('수정안 미리보기'));
  const status = await waitFor(() => screen.getByRole('status'));
  expect(onProposal).toHaveBeenCalledTimes(1);
  expect(status.textContent).toContain('"채널별 매출" → "지역별 매출"');
  expect(status.textContent).toContain('제목만 바뀌었고');
  expect(status.textContent).toContain('SUM(amount)');
  expect(status.textContent).toContain('channel');
});
