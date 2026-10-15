import { describe, expect, it } from 'vitest';
import { canCreateRemix, validateRemixPreview, validateRemixRequirements } from './studioRemixApi';
const token = 'a'.repeat(64);
const requirements = () => ({
  token,
  version: 1,
  title: 'Shared',
  requiredFields: [{ name: 'amount', type: 'BIGINT', blockIds: ['block-1'] }],
  blocks: [{ id: 'block-1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
});
const request = () => ({ targetSourceId: 4, mapping: { amount: 'total' }, excludedBlockIds: [], expectedVersion: 1 });
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
