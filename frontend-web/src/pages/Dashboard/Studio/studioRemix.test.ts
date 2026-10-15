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
