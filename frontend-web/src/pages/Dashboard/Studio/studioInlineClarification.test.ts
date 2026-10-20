import { beforeEach, expect, it, vi } from 'vitest';
import { clarifyExecutionCreation, messageExecutionCreation } from './studioExecution';
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: api.post }));
const binding = { proposalId: 'parent', sourceId: 32, sourceRevision: 'a'.repeat(64) };
const run: any = {
  runId: 'inline-1',
  requestId: 'request-1',
  dashboardId: 39,
  status: 'succeeded',
  steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
  creationResult: binding,
};
const request = {
  requestId: 'answer-1',
  proposalId: 'parent',
  expectedSourceRevision: binding.sourceRevision,
  refundDenominator: 'amount' as const,
};
beforeEach(() => vi.resetAllMocks());
it('accepts only a new preview binding for the same run and source revision', async () => {
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'child' } } });
  const controller = new AbortController();
  expect((await clarifyExecutionCreation(run, request, controller.signal)).creationResult?.proposalId).toBe('child');
  expect(api.post.mock.calls[0][2].signal).toBe(controller.signal);
});
it.each([
  { runId: 'other' },
  { creationResult: undefined },
  { creationResult: { ...binding, sourceId: 31, proposalId: 'child' } },
  { creationResult: { ...binding, sourceRevision: 'b'.repeat(64), proposalId: 'child' } },
  { creationResult: binding },
])('refuses a stale or mismatched answer response %j', async patch => {
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'child' }, ...patch } });
  await expect(clarifyExecutionCreation(run, request)).rejects.toThrow();
});

it('UC034 accepts a newly bound requested source and rejects an unrelated source response', async () => {
  const request = {
    requestId: 'source-1',
    proposalId: 'parent',
    expectedSourceRevision: binding.sourceRevision,
    targetSourceId: 33,
  };
  api.post.mockResolvedValue({
    data: { ...run, creationResult: { ...binding, proposalId: 'child', sourceId: 33, sourceRevision: 'b'.repeat(64) } },
  });
  expect((await clarifyExecutionCreation(run, request)).creationResult?.sourceId).toBe(33);
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'child', sourceId: 34 } } });
  await expect(clarifyExecutionCreation(run, request)).rejects.toThrow();
});

it('UC035 sends a bound refinement with an abort signal and rejects a stale parent reply', async () => {
  const edit = {
    requestId: 'refine-1',
    proposalId: 'parent',
    expectedSourceRevision: binding.sourceRevision,
    prompt: 'Rename',
    targetBlockIndex: 'append' as const,
  };
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'edited' } } });
  const controller = new AbortController();
  expect((await clarifyExecutionCreation(run, edit, controller.signal)).creationResult?.proposalId).toBe('edited');
  expect(api.post.mock.calls[0][1]).toEqual(edit);
  expect(api.post.mock.calls[0][2].signal).toBe(controller.signal);
  api.post.mockResolvedValue({ data: run });
  await expect(clarifyExecutionCreation(run, edit)).rejects.toThrow();
});

it('UC036 validates a bound composer response and rejects another source', async () => {
  const request = {
    requestId: 'message-1',
    proposalId: 'parent',
    expectedSourceRevision: binding.sourceRevision,
    prompt: '첫 번째 블록 변경',
  };
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'child' } } });
  expect((await messageExecutionCreation(run, request)).creationResult?.proposalId).toBe('child');
  expect(api.post.mock.calls[0][1]).toEqual(request);
  api.post.mockResolvedValue({ data: { ...run, creationResult: { ...binding, proposalId: 'child', sourceId: 99 } } });
  await expect(messageExecutionCreation(run, request)).rejects.toThrow();
});
