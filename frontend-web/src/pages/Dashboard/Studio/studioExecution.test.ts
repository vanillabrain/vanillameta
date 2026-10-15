import { describe, it, expect, vi } from 'vitest';
import {
  validateExecution,
  retryStep,
  executionSummary,
  documentFingerprint,
  canResumeExecution,
  validatePublicationResult,
  publishedDashboardPath,
  validateRemixResult,
  publishedRemixPath,
  remixHandoff,
} from './studioExecution';
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

const publication = () => ({
  token: 'publication_token_12345678',
  version: 2,
  visibility: 'link' as const,
  allowRemix: false,
  expiresAt: null,
  asOf: '2026-10-15T10:30:00.000Z',
});
const published = () => ({
  ...run(),
  status: 'succeeded',
  steps: [
    { stepId: 'saveDraft', status: 'succeeded', retryable: false },
    { stepId: 'publish', status: 'succeeded', retryable: false },
  ],
  publicationResult: publication(),
});
describe('publication receipts', () => {
  it('validates durable metadata and constructs only a local published route', () => {
    const value = validateExecution(published(), 8);
    expect(value.publicationResult).toEqual(publication());
    expect(publishedDashboardPath(value.publicationResult)).toBe('/published/publication_token_12345678');
    expect(executionSummary(value)).toContain('저장 완료 · 게시 완료 · v2 · 링크 공유');
    expect(
      executionSummary(
        validateExecution({ ...published(), publicationResult: { ...publication(), visibility: 'private' } }, 8),
      ),
    ).toContain('비공개');
  });
  it.each([
    { token: 'javascript:alert(1)' },
    { token: '../evil' },
    { token: 'https://example.com/publication' },
    { version: 0 },
    { version: 1.5 },
    { visibility: 'public' },
    { allowRemix: 'true' },
    { asOf: '<img src=x onerror=alert(1)>' },
    { asOf: '2026-02-31T00:00:00Z' },
    { expiresAt: 'tomorrow' },
    { asOf: undefined },
    { expiresAt: undefined },
    { html: '<script>bad</script>' },
    { dataVersion: '<script>bad</script>' },
    { revokedAt: '<script>bad</script>' },
    { revokedAt: '2026-02-31T00:00:00Z' },
    { revokedAt: true },
  ])('rejects malformed or extra publication metadata: %j', patch => {
    expect(() => validatePublicationResult({ ...publication(), ...patch })).toThrow();
  });
  it('shares the publication contract, retaining revocation state while omitting owner IDs', () => {
    const dataVersion = 'f'.repeat(64);
    const value = validatePublicationResult({ ...publication(), dataVersion, dashboardId: 8, revokedAt: null });
    expect(value).toEqual({ ...publication(), dataVersion, revokedAt: null });
    expect(value).not.toHaveProperty('dashboardId');
    expect(value.revokedAt).toBeNull();
  });
  it('retains the current revoked receipt and reports the committed save without claiming publication success', () => {
    const revokedAt = '2026-10-15T11:00:00.000Z';
    const value = validateExecution({ ...published(), publicationResult: { ...publication(), revokedAt } }, 8);
    expect(value.publicationResult.revokedAt).toBe(revokedAt);
    expect(executionSummary(value)).toContain('저장 완료 · 게시 중지됨 · v2');
    expect(executionSummary(value)).not.toContain('게시 완료');
    expect(executionSummary(value)).not.toContain('링크 공유');
  });
  it('rejects null metadata and receipts without a completed publication step', () => {
    expect(() => validateExecution({ ...published(), publicationResult: null }, 8)).toThrow();
    expect(() => validateExecution({ ...published(), steps: run().steps }, 8)).toThrow();
  });
  it('reports publication failure explicitly while preserving committed save', () => {
    const value = validateExecution(
      {
        ...run(),
        status: 'partial',
        steps: [
          { stepId: 'saveDraft', status: 'succeeded', retryable: false },
          { stepId: 'publish', status: 'failed', retryable: true },
        ],
      },
      8,
    );
    expect(executionSummary(value)).toContain('저장 완료 · 게시 실패');
    expect(executionSummary(value)).toContain('게시 링크는 갱신되지 않았습니다');
    expect(retryStep(value)?.stepId).toBe('publish');
  });
});
it('allows only the exact committed snapshot to resume publication after the saved editor remounts', async () => {
  const { webcrypto } = await import('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
  try {
    const document: any = { title: 'Committed', dashboardId: 8, sourceId: 10, revision: 'c'.repeat(64) };
    const context: any = {
      dashboardId: 8,
      document,
      expectedRevision: document.revision,
      expectedSourceRevision: 'b'.repeat(64),
      clientEditVersion: 0,
      selectedBlockId: 'saved-b1',
    };
    const value: any = {
      ...run(),
      baseRevision: 'a'.repeat(64),
      sourceRevision: context.expectedSourceRevision,
      baseDocumentHash: 'd'.repeat(64),
      selectedBlockId: 'new:b1',
      saveResult: { document, idMap: { 'new:b1': 'saved-b1' } },
      steps: [
        { stepId: 'saveDraft', status: 'succeeded', retryable: false },
        { stepId: 'publish', status: 'failed', retryable: true },
      ],
    };
    expect(await canResumeExecution(value, context, true)).toBe(true);
    for (const patch of [
      { expectedRevision: 'e'.repeat(64) },
      { document: { ...document, title: 'Manual edit' } },
      { expectedSourceRevision: 'f'.repeat(64) },
      { clientEditVersion: 1 },
      { dashboardId: 9 },
    ])
      expect(await canResumeExecution(value, { ...context, ...patch }, true)).toBe(false);
    expect(await canResumeExecution({ ...value, steps: value.steps.slice(1) }, context, true)).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

const remixResult = () => ({ token: 'a'.repeat(64), version: 3 });
const remixed = () => ({
  ...run(),
  status: 'succeeded',
  steps: [
    { stepId: 'inspectSource', status: 'succeeded', retryable: false },
    { stepId: 'remix', status: 'succeeded', retryable: false },
  ],
  remixResult: remixResult(),
});
const remixFailure = () => ({
  ...run(),
  status: 'failed',
  steps: [{ stepId: 'remix', status: 'failed', retryable: true, errorCode: 'REMIX_UNAVAILABLE' }],
});
describe('remix handoff receipts', () => {
  it('validates the handoff metadata and builds only a local remix route', () => {
    const value = validateExecution(remixed(), 8);
    expect(value.remixResult).toEqual(remixResult());
    expect(publishedRemixPath(value.remixResult)).toBe('/published/' + 'a'.repeat(64) + '/remix');
    expect(executionSummary(value)).toBe(
      '복제 준비 완료 · v3. 내 데이터와 열 매핑을 확인하고 아래 연결 카드에서 저장 상태를 확인해 주세요.',
    );
    expect(executionSummary(value)).not.toContain('저장 완료');
    expect(executionSummary(value)).not.toContain('게시 완료');
    expect(remixHandoff(value)).toEqual(remixResult());
    expect(remixHandoff(validateExecution({ ...remixed(), status: 'completed' }, 8))).toEqual(remixResult());
  });
  it.each([
    { token: 'a'.repeat(63) },
    { token: 'a'.repeat(65) },
    { token: 'A'.repeat(64) },
    { token: 'z'.repeat(64) },
    { token: '../evil' },
    { token: 'javascript:alert(1)' },
    { token: 'https://example.com/published/' + 'a'.repeat(64) },
    { token: undefined },
    { token: 42 },
    { version: 0 },
    { version: -1 },
    { version: 1.5 },
    { version: '3' },
    { version: undefined },
    { version: true },
    { href: '/published/' + 'a'.repeat(64) + '/remix' },
    { url: '/published/' + 'a'.repeat(64) + '/remix' },
    { html: '<a href="/published/x/remix">복제</a>' },
  ])('rejects malformed or extra handoff metadata: %j', extra => {
    expect(() => validateRemixResult({ ...remixResult(), ...extra })).toThrow();
    expect(() => validateExecution({ ...remixed(), remixResult: { ...remixResult(), ...extra } }, 8)).toThrow();
  });
  it('refuses a handoff unless the remix step and the overall run completed', () => {
    for (const patch of [
      { status: 'failed' },
      { status: 'partial' },
      { status: 'running' },
      { status: 'interrupted' },
      { status: 'cancelled' },
      { steps: [{ stepId: 'remix', status: 'failed', retryable: true }] },
      { steps: [{ stepId: 'remix', status: 'pending', retryable: false }] },
      { steps: [{ stepId: 'inspectSource', status: 'succeeded', retryable: false }] },
    ])
      expect(() => validateExecution({ ...remixed(), ...patch }, 8)).toThrow();
    expect(() => validateExecution({ ...remixed(), remixResult: null }, 8)).toThrow();
    expect(remixHandoff({ ...remixed(), status: 'running' } as any)).toBeUndefined();
    expect(remixHandoff({ ...remixed(), status: 'partial' } as any)).toBeUndefined();
  });
  it('reports an unavailable remix target explicitly without a handoff or a saved clone', () => {
    const value = validateExecution(remixFailure(), 8);
    expect(executionSummary(value)).toBe(
      '복제할 게시본이 없거나 접근·복제 허용·만료 상태를 확인하지 못했습니다. 게시 설정이나 링크를 확인해 주세요. 기존 초안은 유지했습니다.',
    );
    expect(executionSummary(value)).not.toContain('저장 완료');
    expect(remixHandoff(value)).toBeUndefined();
    expect(retryStep(value)?.stepId).toBe('remix');
    expect(validateExecution(remixFailure(), 8).remixResult).toBeUndefined();
    expect(() => validateExecution({ ...remixFailure(), remixResult: remixResult() }, 8)).toThrow();
  });
});

describe('T14 private remix receipt', () => {
  const completed = () => ({
    ...run(),
    status: 'succeeded',
    steps: [{ stepId: 'remix', status: 'succeeded', retryable: false }],
    remixResult: { token: 'a'.repeat(64), version: 2 },
    remixSaveResult: { dashboardId: 44, sourceId: 22, revision: 'b'.repeat(64), version: 2 },
  });
  it('retains a checked private clone receipt and reports completion', () => {
    expect(executionSummary(validateExecution(completed(), 8))).toContain('비공개 복제 완료');
  });
  it.each([{ dashboardId: 8 }, { sourceId: 0 }, { revision: 'oops' }, { version: 3 }, { url: 'javascript:bad' }])(
    'rejects forged clone metadata %j',
    patch => {
      const value = completed();
      expect(() => validateExecution({ ...value, remixSaveResult: { ...value.remixSaveResult, ...patch } }, 8)).toThrow();
    },
  );
});

it('T15 validates new creation receipts without permitting current-document writes or forged targets', () => {
  const value = {
    ...run(),
    status: 'succeeded',
    steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
    creationResult: { proposalId: 'proposal-t15', sourceId: 9, sourceRevision: 'a'.repeat(64) },
  };
  expect(executionSummary(validateExecution(value, 8))).toContain('지표·차원');
  const receipt = { dashboardId: 25, sourceId: 9, revision: 'b'.repeat(64) };
  expect(executionSummary(validateExecution({ ...value, creationSaveResult: receipt }, 8))).toContain('비공개 생성 완료');
  for (const patch of [{ dashboardId: 8 }, { sourceId: 10 }, { revision: 'bad' }])
    expect(() => validateExecution({ ...value, creationSaveResult: { ...receipt, ...patch } }, 8)).toThrow();
  expect(() => validateExecution({ ...value, status: 'failed' }, 8)).toThrow();
  expect(() => validateExecution({ ...value, result: {} }, 8)).toThrow();
});
