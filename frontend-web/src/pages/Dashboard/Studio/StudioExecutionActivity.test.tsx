import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import StudioExecutionActivity from './StudioExecutionActivity';
import { StudioExecution } from './studioExecution';
vi.mock('./StudioSemanticReview', () => ({ default: () => <div>Semantic preview</div> }));
afterEach(cleanup);
const run = (): StudioExecution => ({
  runId: 'r1',
  requestId: 'q1',
  dashboardId: 8,
  status: 'failed',
  steps: [
    { stepId: 'inspectSource', status: 'succeeded', retryable: false },
    { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
    { stepId: 'preview', status: 'failed', retryable: true },
  ],
});
it('offers only the failed stage and shows completed model inference separately', () => {
  const retry = vi.fn();
  const value = run();
  render(
    <StudioExecutionActivity
      runs={[value]}
      busy={false}
      error=""
      onRefresh={() => undefined}
      onRetry={retry}
      onCancel={() => undefined}
      canRetry={() => true}
    />,
  );
  expect(screen.queryByRole('button', { name: 'AI 제안 다시 시도' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '계산 검증 다시 시도' }));
  expect(retry).toHaveBeenCalledWith(value);
  expect(screen.getByRole('list', { name: '실행 단계' }).textContent).toContain('AI 제안완료');
});
it('preserves truthful saved status on partial failure and blocks unsafe retry', () => {
  render(
    <StudioExecutionActivity
      runs={[
        {
          ...run(),
          status: 'partial',
          requiresRequest: true,
          steps: [
            { stepId: 'saveDraft', status: 'succeeded', retryable: false },
            { stepId: 'publish', status: 'failed', retryable: true },
          ],
        },
      ]}
      busy={false}
      error=""
      onRefresh={() => undefined}
      onRetry={() => undefined}
      onCancel={() => undefined}
      canRetry={() => false}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('저장 완료');
  expect((screen.getByRole('button', { name: '공유 다시 시도' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/원래 요청을 아래 입력란/)).toBeDefined();
});

it('restores a link, version, scope and data time from recent activity after remount', () => {
  const value: StudioExecution = {
    ...run(),
    status: 'succeeded',
    steps: [
      { stepId: 'saveDraft', status: 'succeeded', retryable: false },
      { stepId: 'publish', status: 'succeeded', retryable: false },
    ],
    publicationResult: {
      token: 'publication_token_12345678',
      version: 2,
      visibility: 'private',
      allowRemix: false,
      asOf: '2026-10-15T10:30:00.000Z',
      expiresAt: '2026-10-16T10:30:00.000Z',
    },
  };
  const props = {
    runs: [value],
    busy: false,
    error: '',
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onCancel: vi.fn(),
    canRetry: () => true,
  };
  const first = render(<StudioExecutionActivity {...props} />);
  first.unmount();
  render(<StudioExecutionActivity {...props} />);
  const link = screen.getByRole('link', { name: '게시본 v2 열기' });
  expect(link.getAttribute('href')).toBe('/published/publication_token_12345678');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(screen.getByText(/비공개 · 소유자만/)).toBeDefined();
  expect(screen.getByText('2026-10-15 10:30:00.000 UTC')).toBeDefined();
  expect(screen.getByText('2026-10-16 10:30:00.000 UTC')).toBeDefined();
  expect(screen.queryByRole('button', { name: '공유 다시 시도' })).toBeNull();
});

it('offers inline mapping without claiming a saved clone', () => {
  const value: StudioExecution = {
    ...run(),
    status: 'succeeded',
    steps: [
      { stepId: 'inspectSource', status: 'succeeded', retryable: false },
      { stepId: 'remix', status: 'succeeded', retryable: false },
    ],
    remixResult: { token: 'a'.repeat(64), version: 3 },
  };
  const props = {
    runs: [value],
    busy: false,
    error: '',
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onCancel: vi.fn(),
    canRetry: () => true,
    onRemix: vi.fn().mockResolvedValue(undefined),
  };
  const first = render(<StudioExecutionActivity {...props} />);
  first.unmount();
  render(<StudioExecutionActivity {...props} />);
  expect(screen.getByRole('button', { name: '내 데이터 연결하고 복제 계속' })).toBeDefined();
  expect(screen.queryByRole('link', { name: '내 데이터 연결하고 복제 계속' })).toBeNull();
  expect(
    screen.getByText('복제 준비 완료 · v3. 내 데이터와 열 매핑을 확인하고 아래 연결 카드에서 저장 상태를 확인해 주세요.'),
  ).toBeDefined();
  expect(screen.getByText(/현재 초안은 유지됩니다/)).toBeDefined();
  expect(screen.getByText('복제 준비')).toBeDefined();
  expect(screen.queryByText(/저장 완료|게시 완료/)).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 다시 시도' })).toBeNull();
});

it('shows an unavailable remix failure with no handoff link and an explicit retry', () => {
  const retry = vi.fn();
  const value: StudioExecution = {
    ...run(),
    status: 'failed',
    steps: [{ stepId: 'remix', status: 'failed', retryable: true, errorCode: 'REMIX_UNAVAILABLE' }],
  };
  render(
    <StudioExecutionActivity
      runs={[value]}
      busy={false}
      error=""
      onRefresh={vi.fn()}
      onRetry={retry}
      onCancel={vi.fn()}
      canRetry={() => true}
    />,
  );
  expect(screen.getByRole('status').textContent).toBe(
    '복제할 게시본이 없거나 접근·복제 허용·만료 상태를 확인하지 못했습니다. 게시 설정이나 링크를 확인해 주세요. 기존 초안은 유지했습니다.',
  );
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '복제 준비 다시 시도' }));
  expect(retry).toHaveBeenCalledWith(value);
});
it('does not offer a stale or fabricated link when publication failed after saving', () => {
  const retry = vi.fn();
  const value: StudioExecution = {
    ...run(),
    status: 'partial',
    steps: [
      { stepId: 'saveDraft', status: 'succeeded', retryable: false },
      { stepId: 'publish', status: 'failed', retryable: true },
    ],
  };
  render(
    <StudioExecutionActivity
      runs={[value]}
      busy={false}
      error=""
      onRefresh={vi.fn()}
      onRetry={retry}
      onCancel={vi.fn()}
      canRetry={() => true}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('게시 실패');
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '공유 다시 시도' }));
  expect(retry).toHaveBeenCalledWith(value);
});

it('shows a revoked receipt as stopped and removes its success link while retaining the committed save', () => {
  const value: StudioExecution = {
    ...run(),
    status: 'succeeded',
    steps: [
      { stepId: 'saveDraft', status: 'succeeded', retryable: false },
      { stepId: 'publish', status: 'succeeded', retryable: false },
    ],
    publicationResult: {
      token: 'publication_token_12345678',
      version: 2,
      visibility: 'link',
      allowRemix: false,
      asOf: '2026-10-15T10:30:00.000Z',
      expiresAt: null,
      revokedAt: '2026-10-15T11:00:00.000Z',
    },
  };
  const props = {
    runs: [value],
    busy: false,
    error: '',
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onCancel: vi.fn(),
    canRetry: () => true,
  };
  const first = render(<StudioExecutionActivity {...props} />);
  first.unmount();
  render(<StudioExecutionActivity {...props} />);
  expect(screen.getByText('게시 중지됨')).toBeDefined();
  expect(screen.getByText(/저장 완료 · 게시 중지됨 · v2/)).toBeDefined();
  expect(screen.getByText('2026-10-15 11:00:00.000 UTC')).toBeDefined();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByText(/게시 완료/)).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 다시 시도' })).toBeNull();
});

it('restores a private clone receipt without replaying creation and links separately from the current editor', () => {
  const value: StudioExecution = {
    ...run(),
    status: 'succeeded',
    steps: [{ stepId: 'remix', status: 'succeeded', retryable: false }],
    remixResult: { token: 'a'.repeat(64), version: 3 },
    remixSaveResult: { dashboardId: 44, sourceId: 22, revision: 'b'.repeat(64), version: 3 },
  };
  render(
    <StudioExecutionActivity
      runs={[value]}
      busy={false}
      error=""
      onRefresh={vi.fn()}
      onRetry={vi.fn()}
      onCancel={vi.fn()}
      canRetry={() => false}
      onRemix={vi.fn()}
    />,
  );
  const link = screen.getByRole('link', { name: '비공개 복제본 열기' });
  expect(link.getAttribute('href')).toBe('/dashboard/44/studio');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(screen.queryByRole('button', { name: '내 데이터 연결하고 복제 계속' })).toBeNull();
  expect(screen.getByText(/현재 편집은 유지했습니다/)).toBeDefined();
});

vi.mock('./StudioRemix', () => ({
  StudioRemixFlow: ({ onSave }: any) => (
    <button
      onClick={() =>
        onSave(
          {
            requestId: 'confirmed-mapping',
            targetSourceId: 22,
            mapping: { amount: 'amount' },
            excludedBlockIds: [],
            expectedVersion: 3,
            expectedLifecycleRevision: 'd'.repeat(64),
            expectedSourceRevision: 'b'.repeat(64),
          },
          () => true,
        )
      }
    >
      매핑 확인 후 비공개 생성
    </button>
  ),
}));
