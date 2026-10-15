import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import StudioExecutionActivity from './StudioExecutionActivity';
import { StudioExecution } from './studioExecution';
vi.mock('@mui/material', () => ({
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: ({ children, disabled, onClick }: any) => (
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
