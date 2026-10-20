import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConditionReports, { validateReports } from './ConditionReports';
const calls = vi.hoisted(() => ({ orgGet: vi.fn(), orgPost: vi.fn() }));
vi.mock('./governanceApi', () => ({
  ...calls,
  assertOrganizationRequest: () => undefined,
  organizationError: () => '기록을 확인하지 못했습니다.',
}));
const rev = 'a'.repeat(64),
  id = '11111111-1111-4111-8111-111111111111';
const catalog: any = {
  viewRevision: rev,
  blocks: [{ id: 'sales', title: '총매출', kind: 'BOARD_NUMERIC', display: {} }],
  capabilities: { export: true },
};
const record = () => ({
  id,
  version: 1,
  active: true,
  restricted: false,
  blockId: 'sales',
  title: '총매출',
  operator: 'gt',
  threshold: '4000',
  intervalSeconds: 60,
  nextAt: new Date().toISOString(),
  records: [
    {
      scheduledAt: new Date().toISOString(),
      outcome: 'matched',
      result: {
        title: '총매출',
        value: 4260,
        viewRevision: rev,
        queriedAt: new Date().toISOString(),
        display: { suffix: 'USD' },
      },
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  calls.orgGet.mockResolvedValue([]);
});
afterEach(cleanup);
it('keeps an uncertain creation envelope and retries the exact same request', async () => {
  render(<ConditionReports orgId={1} dashboardId={21} catalog={catalog} />);
  fireEvent.change(screen.getByLabelText('보고할 숫자 지표'), { target: { value: 'sales' } });
  fireEvent.change(screen.getByLabelText('임계값'), { target: { value: '4000' } });
  calls.orgPost
    .mockRejectedValueOnce(new Error('lost response'))
    .mockImplementationOnce(async (_path, body) => ({ id: body.requestId }));
  fireEvent.click(screen.getByRole('button', { name: '본인 수신 예약 저장' }));
  await screen.findByText('기록을 확인하지 못했습니다.');
  const body = calls.orgPost.mock.calls[0][1];
  expect((screen.getByLabelText('임계값') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '같은 예약 저장 확인' }));
  await screen.findByText(/본인에게만 전달할 예약을 저장/);
  expect(calls.orgPost.mock.calls[1][1]).toEqual(body);
});
it('removes old numbers when the currently resolved policy masks report history', async () => {
  calls.orgGet.mockResolvedValueOnce([record()]).mockResolvedValueOnce([{ ...record(), restricted: true, records: [] }]);
  render(<ConditionReports orgId={1} dashboardId={21} catalog={catalog} />);
  await screen.findByText(/4,260/);
  fireEvent.click(screen.getByRole('button', { name: '기록 다시 확인' }));
  await screen.findByText(/이전 보고의 숫자를 숨겼습니다/);
  expect(screen.queryByText(/4,260/)).toBeNull();
});
it('rejects A historical values from another view revision and numbers on a failed occurrence', () => {
  const old = record();
  old.records[0].result.viewRevision = 'b'.repeat(64);
  expect(() => validateReports([old], catalog)).toThrow();
  const failed = record();
  failed.records[0].outcome = 'failed';
  expect(() => validateReports([failed], catalog)).toThrow();
});
