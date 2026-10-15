import { describe, it, expect, vi } from 'vitest';
import { validateExecution, retryStep, executionSummary, documentFingerprint, canResumeExecution } from './studioExecution';
const run = () => ({
  runId: 'run-1',
  requestId: 'request-1',
  dashboardId: 8,
  status: 'failed',
  steps: [
    { stepId: 'inspectSource', status: 'succeeded', retryable: false },
    { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
    { stepId: 'preview', status: 'failed', retryable: true, errorCode: 'PREVIEW_FAILED' },
  ],
});
describe('durable Studio activity boundary', () => {
  it('only retries the failed step, never an already completed model call', () => {
    const value = validateExecution(run(), 8);
    expect(retryStep(value)?.stepId).toBe('preview');
  });
  it('rejects another dashboard and unsupported step names', () => {
    expect(() => validateExecution(run(), 9)).toThrow();
    expect(() => validateExecution({ ...run(), steps: [{ stepId: 'shell', status: 'succeeded' }] }, 8)).toThrow();
  });
  it('distinguishes a committed save from a failed following step', () => {
    const value = validateExecution(
      {
        ...run(),
        status: 'partial',
        steps: [
          { stepId: 'saveDraft', status: 'succeeded', retryable: false },
          { stepId: 'publish', status: 'failed', retryable: false },
        ],
      },
      8,
    );
    expect(executionSummary(value)).toContain('저장 완료');
    expect(executionSummary(value)).not.toContain('저장하지 못');
    expect(retryStep(value)).toBeUndefined();
  });
  it('does not offer retry of a terminal unsupported operation', () => {
    const value = validateExecution(
      { ...run(), status: 'unsupported', steps: [{ stepId: 'publish', status: 'unsupported', retryable: false }] },
      8,
    );
    expect(retryStep(value)).toBeUndefined();
  });
});

it('blocks historical retry after reload when the current document changed, even without an original request in memory', async () => {
  const { webcrypto } = await import('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
  try {
    const context: any = {
      dashboardId: 8,
      document: { title: 'Before', sourceId: 10 },
      expectedRevision: 'a'.repeat(64),
      expectedSourceRevision: 'b'.repeat(64),
      clientEditVersion: 0,
    };
    const value: any = {
      ...run(),
      baseRevision: context.expectedRevision,
      sourceRevision: context.expectedSourceRevision,
      selectedBlockId: null,
      baseDocumentHash: await documentFingerprint(context.document),
    };
    expect(await canResumeExecution(value, context, true)).toBe(true);
    expect(await canResumeExecution(value, { ...context, document: { ...context.document, title: 'manual' } }, true)).toBe(
      false,
    );
    expect(await canResumeExecution(value, { ...context, clientEditVersion: 2 }, true)).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
