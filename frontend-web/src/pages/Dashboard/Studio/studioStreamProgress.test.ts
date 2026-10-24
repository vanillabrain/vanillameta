import { describe, expect, it, vi } from 'vitest';
import { progressRun } from './studioExecution';
import { studioAssistantTransport } from './studioRunTransport';
import { validateStudioDocument } from './studioDocument';
import { StreamApiError } from '@/api/ndjsonClient';

const document = validateStudioDocument({
  schemaVersion: 1,
  dashboardId: 3,
  sourceId: 4,
  title: 'Test',
  blocks: [
    {
      id: 'b1',
      kind: 'CHART_LINE',
      definitionKey: 'd1',
      title: 'Daily',
      description: '',
      measureRefs: [],
      dimensionRefs: [],
      display: {},
    },
  ],
  layouts: {
    lg: [{ id: 'b1', x: 0, y: 0, w: 12, h: 5 }],
    md: [{ id: 'b1', x: 0, y: 0, w: 8, h: 5 }],
    xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 5 }],
  },
});
const context = {
  dashboardId: 3,
  document,
  expectedRevision: 'a'.repeat(64),
  expectedSourceRevision: 'b'.repeat(64),
  clientEditVersion: 2,
  selectedBlockId: 'b1',
};
const message = { messages: [{ role: 'user', parts: [{ type: 'text', text: 'Edit' }] }] } as any;
const finalRun = {
  runId: 'run-1',
  requestId: 'q1',
  dashboardId: 3,
  status: 'failed',
  steps: [
    { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
    { stepId: 'preview', status: 'failed', retryable: true },
  ],
};

describe('progressRun', () => {
  const base = { dashboardId: 3, requestId: 'q1', runId: 'run-1', status: 'running' };

  it('is the run as the stream knows it: ids and statuses, no results', () => {
    const run = progressRun(
      {
        ...base,
        steps: [
          { stepId: 'inspectSource', status: 'succeeded', retryable: false },
          { stepId: 'proposeSemantics', status: 'running', retryable: false },
        ],
      },
      3,
    )!;
    expect(run).toEqual({
      runId: 'run-1',
      requestId: 'q1',
      dashboardId: 3,
      status: 'running',
      steps: [
        { stepId: 'inspectSource', status: 'succeeded', retryable: false },
        { stepId: 'proposeSemantics', status: 'running', retryable: false },
      ],
    });
  });

  it('keeps an error code and the retryable flag of a failed step', () => {
    const run = progressRun(
      {
        ...base,
        status: 'failed',
        steps: [{ stepId: 'preview', status: 'failed', retryable: true, errorCode: 'PREVIEW_FAILED' }],
      },
      3,
    )!;
    expect(run.steps[0]).toEqual({ stepId: 'preview', status: 'failed', retryable: true, errorCode: 'PREVIEW_FAILED' });
  });

  it('drops what this page does not know instead of showing it, including inherited object keys', () => {
    const run = progressRun(
      {
        ...base,
        status: 'constructor',
        steps: [
          { stepId: 'launchRockets', status: 'running' },
          { stepId: 'toString', status: 'running' },
          { stepId: 'preview', status: 'hasOwnProperty' },
          { stepId: 'preview', status: 'running', errorCode: 'x'.repeat(200) },
        ],
      },
      3,
    )!;
    expect(run.status).toBe('running');
    expect(run.steps).toEqual([{ stepId: 'preview', status: 'running', retryable: false }]);
  });

  it.each([
    [{ ...base, runId: '../x', steps: [] }],
    [{ ...base, runId: 'r'.repeat(200), steps: [] }],
    [{ ...base, requestId: 'q'.repeat(200), steps: [] }],
    [{ ...base, steps: 'nope' }],
    [undefined],
  ])('refuses an event that is not a run (%j)', progress => {
    expect(progressRun(progress as any, 3)).toBeNull();
  });

  it('does not show a step of a request made for another dashboard', () => {
    expect(progressRun({ ...base, dashboardId: 9, steps: [{ stepId: 'preview', status: 'running' }] }, 3)).toBeNull();
  });

  it('shows at most twelve steps', () => {
    const steps = Array.from({ length: 40 }, () => ({ stepId: 'preview', status: 'running' }));
    expect(progressRun({ ...base, steps }, 3)!.steps).toHaveLength(12);
  });
});

describe('the Studio transport streams the execution', () => {
  const sdk = async () => await import('@/api/ndjsonClient');

  it('reports progress with the request id while the server works, then settles once with the run', async () => {
    const api = await sdk();
    const onRequest = vi.fn();
    const onExecution = vi.fn();
    const onProgress = vi.fn();
    const onSettled = vi.fn();
    const spy = vi.spyOn(api, 'postNdjson').mockImplementation(async (_url, _body, options) => {
      options?.onEvent?.({ type: 'start' });
      options?.onEvent?.({
        type: 'step',
        runId: 'run-1',
        status: 'running',
        steps: [{ stepId: 'inspectSource', status: 'running' }],
      });
      options?.onEvent?.({ type: 'heartbeat' });
      expect(onSettled).not.toHaveBeenCalled();
      return finalRun;
    });
    try {
      const stream = await studioAssistantTransport(() => context, {
        onRequest,
        onExecution,
        onProgress,
        onSettled,
      }).sendMessages(message);
      expect(spy.mock.calls[0][0]).toBe('/studio/executions');
      // Only step lines are progress; start and heartbeat are not.
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith({
        dashboardId: 3,
        requestId: onRequest.mock.calls[0][0].requestId,
        runId: 'run-1',
        status: 'running',
        steps: [{ stepId: 'inspectSource', status: 'running' }],
      });
      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onExecution).toHaveBeenCalledWith(finalRun);
      expect(stream).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('hands the chat’s abort signal to the stream, so stopping closes the connection', async () => {
    const api = await sdk();
    const controller = new AbortController();
    const spy = vi.spyOn(api, 'postNdjson').mockResolvedValue(finalRun as any);
    try {
      await studioAssistantTransport(() => context, { onRequest: vi.fn(), onExecution: vi.fn() }).sendMessages({
        ...message,
        abortSignal: controller.signal,
      });
      expect(spy.mock.calls[0][2]?.signal).toBe(controller.signal);
    } finally {
      spy.mockRestore();
    }
  });

  it('settles and explains a refusal that arrives as an error event, with the server’s words', async () => {
    const api = await sdk();
    const onSettled = vi.fn();
    const error = new StreamApiError('오늘의 AI 호출을 모두 썼습니다.', {
      status: 429,
      data: { success: false, code: 429, data: { error: 'AI_QUOTA_EXCEEDED', message: '오늘의 AI 호출을 모두 썼습니다.' } },
    });
    const spy = vi.spyOn(api, 'postNdjson').mockRejectedValue(error);
    try {
      await expect(
        studioAssistantTransport(() => context, { onRequest: vi.fn(), onExecution: vi.fn(), onSettled }).sendMessages(
          message,
        ),
      ).rejects.toMatchObject({ message: '오늘의 AI 호출을 모두 썼습니다.' });
      expect(onSettled).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('settles when the connection drops without an outcome, and says the result is unknown', async () => {
    const api = await sdk();
    const onSettled = vi.fn();
    const spy = vi
      .spyOn(api, 'postNdjson')
      .mockRejectedValue(new StreamApiError('The stream ended before the server reported an outcome.'));
    try {
      await expect(
        studioAssistantTransport(() => context, { onRequest: vi.fn(), onExecution: vi.fn(), onSettled }).sendMessages(
          message,
        ),
      ).rejects.toMatchObject({ kind: 'network' });
      expect(onSettled).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
