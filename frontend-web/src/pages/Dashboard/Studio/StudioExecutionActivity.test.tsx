import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import StudioExecutionActivity from './StudioExecutionActivity';
import { StudioExecution } from './studioExecution';
vi.mock('@mui/material', () => ({
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: ({ children, disabled, onClick, component, href, target, rel }: any) =>
    component === 'a' ? (
      <a href={href} target={target} rel={rel}>
        {children}
      </a>
    ) : (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
}));
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
