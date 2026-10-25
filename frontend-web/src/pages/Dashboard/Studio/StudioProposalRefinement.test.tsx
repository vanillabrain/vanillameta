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
  expect(status.textContent).toContain('제목 외에');
  expect(status.textContent).toContain('SUM(amount)');
  expect(status.textContent).toContain('channel');
});

it('compares the chosen block, not the first one, and the last block on append', async () => {
  const two = (a: string, b: string, parent?: string): CreationProposal => ({
    ...proposal(a, parent),
    semanticProposal: [block(a), block(b)],
  });
  const onProposal = vi.fn();
  const view = render(
    <StudioProposalRefinement
      proposal={two('첫째', '둘째')}
      disabled={false}
      onProposal={onProposal}
      onBusy={() => undefined}
    />,
  );
  vi.mocked(proposeStudio).mockResolvedValueOnce(two('첫째', '셋째', 'parent'));
  fireEvent.change(screen.getByLabelText('수정할 블록'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('생성안 수정 요청'), { target: { value: '둘째 제목 변경' } });
  fireEvent.click(screen.getByText('수정안 미리보기'));
  const status = await waitFor(() => screen.getByRole('status'));
  expect(status.textContent).toContain('"둘째" → "셋째"');
  expect(status.textContent).not.toContain('첫째');
  view.unmount();

  const appended: CreationProposal = {
    ...two('첫째', '둘째', 'parent'),
    semanticProposal: [block('첫째'), block('둘째'), block('추가')],
  };
  vi.mocked(proposeStudio).mockResolvedValueOnce(appended);
  render(
    <StudioProposalRefinement
      proposal={two('첫째', '둘째')}
      disabled={false}
      onProposal={onProposal}
      onBusy={() => undefined}
    />,
  );
  fireEvent.change(screen.getByLabelText('수정할 블록'), { target: { value: 'append' } });
  fireEvent.change(screen.getByLabelText('생성안 수정 요청'), { target: { value: '블록 추가' } });
  fireEvent.click(screen.getByText('수정안 미리보기'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('새 블록 "추가"'));
});

it('shows no change note and does not apply the proposal while a question is pending', async () => {
  vi.mocked(proposeStudio).mockResolvedValueOnce({
    ...proposal('채널별 매출', 'parent'),
    clarifications: [{ id: 'missingColumns', question: '열이 없습니다', choices: [], affectedBlockIds: [] }],
  });
  const onProposal = vi.fn();
  render(
    <StudioProposalRefinement
      proposal={proposal('채널별 매출')}
      disabled={false}
      onProposal={onProposal}
      onBusy={() => undefined}
    />,
  );
  fireEvent.change(screen.getByLabelText('생성안 수정 요청'), { target: { value: '요청' } });
  fireEvent.click(screen.getByText('수정안 미리보기'));
  await waitFor(() => screen.getByText('열이 없습니다'));
  expect(onProposal).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).toBeNull();
});
