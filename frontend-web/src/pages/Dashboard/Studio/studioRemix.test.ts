import { describe, expect, it } from 'vitest';
import {
  canCreateRemix,
  fetchRemixRequirements,
  remixError,
  remixFailure,
  validateRemixPreview,
  validateRemixRequirements,
} from './studioRemixApi';
const token = 'a'.repeat(64);
const requirements = () => ({
  token,
  lifecycleRevision: 'c'.repeat(64),
  version: 1,
  title: 'Shared',
  requiredFields: [{ name: 'amount', type: 'BIGINT', blockIds: ['block-1'] }],
  blocks: [{ id: 'block-1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
});
const request = () => ({
  expectedLifecycleRevision: 'c'.repeat(64),
  targetSourceId: 4,
  mapping: { amount: 'total' },
  excludedBlockIds: [],
  expectedVersion: 1,
});
const preview = () => ({
  ...requirements(),
  targetSourceId: 4,
  sourceRevision: 'b'.repeat(64),
  profile: { sourceId: 4, rowCount: '2', columns: [{ name: 'total', type: 'BIGINT' }] },
  mapping: { amount: 'total' },
  fields: [{ sourceColumn: 'amount', sourceType: 'BIGINT', targetColumn: 'total', status: 'mapped', candidates: ['total'] }],
  unmappedBlocks: [],
  preview: { widgets: [{ type: 'BOARD_NUMERIC', valueField: 'value', fields: [], datas: [{ value: 500 }] }] },
});
describe('remix common period boundary', () => {
  const dateRange = { column: 'created_at', start: '2024-01-01', end: '2024-01-31' };
  it('keeps the publisher period read-only and refuses a malformed one', () => {
    expect(validateRemixRequirements({ ...requirements(), dateRange }, token).dateRange).toEqual(dateRange);
    for (const malformed of [
      { column: 'created_at', start: '2024-01-01', end: '9999-12-31' },
      { column: 'created_at', start: '0000-01-01', end: '2024-01-01' },
      { column: '', start: '2024-01-01', end: '2024-01-31' },
    ])
      expect(() => validateRemixRequirements({ ...requirements(), dateRange: malformed }, token)).toThrow();
  });
  it('reports the applied period and blocks creation when the saved date column cannot be mapped', () => {
    const mapped = validateRemixPreview({ ...preview(), mappedDateRange: dateRange }, token, request());
    expect(mapped.mappedDateRange).toEqual(dateRange);
    expect(canCreateRemix(mapped, [])).toBe(true);
    const blocked = validateRemixPreview({ ...preview(), unmappedDateRange: 'created_at' }, token, request());
    expect(blocked.unmappedDateRange).toBe('created_at');
    // The server refuses this creation; the screen must not offer it either.
    expect(canCreateRemix(blocked, [])).toBe(false);
    expect(() => validateRemixPreview({ ...preview(), unmappedDateRange: ' ' }, token, request())).toThrow();
    expect(() => validateRemixPreview({ ...preview(), unmappedDateRange: 'c'.repeat(129) }, token, request())).toThrow();
    expect(() =>
      validateRemixPreview(
        { ...preview(), mappedDateRange: { column: 'created_at', start: '2024-02-31', end: '2024-03-05' } },
        token,
        request(),
      ),
    ).toThrow();
  });
});

describe('remix pinned boundary', () => {
  it('rejects a template for another token or unknown field/block links', () => {
    expect(() => validateRemixRequirements({ ...requirements(), token: 'c'.repeat(64) }, token)).toThrow();
    expect(() =>
      validateRemixRequirements(
        { ...requirements(), requiredFields: [{ name: 'amount', type: 'BIGINT', blockIds: ['other'] }] },
        token,
      ),
    ).toThrow();
  });
  it('rejects a late preview for another source or publication version', () => {
    expect(validateRemixPreview(preview(), token, request()).sourceRevision).toBe('b'.repeat(64));
    expect(() => validateRemixPreview({ ...preview(), targetSourceId: 5 }, token, request())).toThrow();
    expect(() => validateRemixPreview({ ...preview(), version: 2 }, token, request())).toThrow();
  });
  it('blocks missing fields and all-excluded results without silently converting types', () => {
    const ready = validateRemixPreview(preview(), token, request());
    expect(canCreateRemix(ready, [])).toBe(true);
    expect(
      canCreateRemix(
        {
          ...ready,
          unmappedBlocks: [{ blockId: 'block-1', title: 'Total', reason: '숫자 형식 불일치', missingFields: ['amount'] }],
        },
        [],
      ),
    ).toBe(false);
    expect(canCreateRemix(ready, ['block-1'])).toBe(false);
    expect(canCreateRemix(null, [])).toBe(false);
  });
});

it('UC052 retains mapped conditions and blocks missing condition fields without auto-excluding blocks', () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const mappedConditions = {
    ...conditions,
    definition: { ...conditions.definition, include: { ...conditions.definition.include, column: 'total' } },
  };
  const mapped = validateRemixPreview(
    { ...preview(), conditions, mappedConditions, unmappedConditions: [] },
    token,
    request(),
  );
  expect(mapped.conditions).toEqual(conditions);
  expect(mapped.mappedConditions).toEqual(mappedConditions);
  expect(canCreateRemix(mapped, [])).toBe(true);
  const blocked = validateRemixPreview({ ...preview(), conditions, unmappedConditions: ['amount'] }, token, request());
  expect(canCreateRemix(blocked, [])).toBe(false);
  expect(blocked.blocks).toEqual(preview().blocks);
  expect(() => validateRemixPreview({ ...preview(), conditions }, token, request())).toThrow();
  expect(() => validateRemixRequirements({ ...requirements(), conditions, requiredFields: [] }, token)).toThrow();
  expect(() =>
    validateRemixPreview(
      { ...preview(), conditions, mappedConditions, unmappedConditions: [], fields: [] },
      token,
      request(),
    ),
  ).toThrow();
  expect(() => validateRemixPreview({ ...preview(), conditions, mappedConditions: null }, token, request())).toThrow();
});
it('review BLOCK2 accepts supported-only condition field links but requires explicit unsupported block exclusion', () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const legacy = { id: 'legacy', title: 'Unlinked legacy', kind: 'BOARD_NUMERIC', supported: false, reason: 'unsupported' };
  const mixed = { ...requirements(), conditions, blocks: [...requirements().blocks, legacy] };
  expect(validateRemixRequirements(mixed, token).requiredFields[0].blockIds).toEqual(['block-1']);
  const mappedConditions = {
    ...conditions,
    definition: { ...conditions.definition, include: { ...conditions.definition.include, column: 'total' } },
  };
  const checked = validateRemixPreview(
    { ...preview(), ...mixed, mappedConditions, unmappedConditions: [] },
    token,
    request(),
  );
  expect(canCreateRemix(checked, [])).toBe(false);
  expect(canCreateRemix(checked, ['legacy'])).toBe(true);
  expect(checked.blocks).toEqual(mixed.blocks);
  expect(checked.mappedConditions).toEqual(mappedConditions);
  const secondSupported = { ...legacy, supported: true };
  expect(() =>
    validateRemixRequirements({ ...mixed, blocks: [...requirements().blocks, secondSupported] }, token),
  ).toThrow();
});

describe('lifecycle proof contract', () => {
  it('requires an opaque lifecycle revision and never defaults missing proof', () => {
    for (const lifecycleRevision of [undefined, null, '', 'invalid'])
      expect(() => validateRemixRequirements({ ...requirements(), lifecycleRevision }, token)).toThrow();
  });
  it('rejects a preview from another lifecycle generation even if token/version/source match', () => {
    expect(() => validateRemixPreview({ ...preview(), lifecycleRevision: 'd'.repeat(64) }, token, request())).toThrow();
    expect(validateRemixPreview(preview(), token, request()).lifecycleRevision).toBe('c'.repeat(64));
  });
});

describe('remix link and failure wording', () => {
  it('words a malformed link with its own sentence, not the generic status fallback', async () => {
    const cause = await fetchRemixRequirements('not-a-link').catch(error => error);
    expect(remixError(cause)).toBe('복제 링크를 확인해 주세요.');
    expect(remixError(cause, true)).toBe('복제 링크를 확인해 주세요.');
  });
  it('offers no retry for a refusal or a missing link, and keeps it for other failures', () => {
    const at = (status: number) => ({ response: { status, data: {} } });
    expect(remixFailure(at(403)).retry).toBe(false);
    expect(remixFailure(at(404)).retry).toBe(false);
    expect(remixFailure(at(410)).retry).toBe(false);
    expect(remixFailure(at(409)).retry).toBe(true);
    expect(remixFailure(at(500)).retry).toBe(true);
    expect(remixFailure(new Error('offline')).retry).toBe(true);
  });
  it('offers no retry for a malformed link, which no request can repair', () => {
    expect(remixFailure(new Error('복제 링크를 확인해 주세요.')).retry).toBe(false);
    expect(remixFailure(new Error('offline')).retry).toBe(true);
  });
  it('keeps the retry for a quota refusal, because the fix is to free a source and try again', () => {
    const quota = {
      response: {
        status: 403,
        data: { success: false, code: 403, data: { error: 'UPLOAD_QUOTA_EXCEEDED', message: '저장 용량 한도에 도달했습니다.' } },
      },
    };
    expect(remixFailure(quota)).toEqual({ message: '저장 용량 한도에 도달했습니다.', retry: true, gone: false });
  });
  it('marks a gone publication so its link back is hidden', () => {
    expect(remixFailure({ response: { status: 404 } }).gone).toBe(true);
    expect(remixFailure({ response: { status: 410 } }).gone).toBe(true);
    expect(remixFailure({ response: { status: 403 } }).gone).toBe(false);
  });
});
