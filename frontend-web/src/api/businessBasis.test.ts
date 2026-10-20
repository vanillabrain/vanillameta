import { describe, expect, it, vi } from 'vitest';
import { assertOptionalBusinessBasis, businessColumnLabel, readBusinessBasis, validBusinessBasis } from './businessBasis';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
import { basisFixture, basisResponse } from './businessBasis.fixture';
describe('business basis server boundary', () => {
  it('preserves canonical frozen columns/refs and nullable native basis without substituting latest metadata', () => {
    const value = structuredClone(basisFixture);
    Object.assign(value.columns[0], { classificationRef: { organizationId: 7, id: 3, version: 1 } });
    expect(validBusinessBasis(value)).toBe(true);
    expect(validBusinessBasis(null)).toBe(true);
    const response = { data: { status: 'SUCCESS', data: { ...basisResponse, businessBasis: value } } };
    expect(readBusinessBasis(response, 1).businessBasis).toEqual(value);
    expect(businessColumnLabel(basisResponse.businessColumns[1])).toBe('결제 금액 · amount · DOUBLE · 원');
  });
  it.each([
    { ...basisFixture, columns: [...basisFixture.columns, basisFixture.columns[0]] },
    { ...basisFixture, catalogVersion: 0 },
    { ...basisFixture, schemaRevision: 'unknown' },
    { ...basisFixture, columns: [{ ...basisFixture.columns[0], sql: 'SELECT secret' }] },
    { ...basisFixture, columns: [{ ...basisFixture.columns[2], dateFormat: '' }] },
    {
      ...basisFixture,
      columns: [{ ...basisFixture.columns[0], classificationRef: { organizationId: 1, id: 2, version: 0 } }],
    },
  ])('fails closed for malformed basis instead of treating it as native', value => {
    expect(validBusinessBasis(value)).toBe(false);
    expect(() => assertOptionalBusinessBasis({ businessBasis: value })).toThrow();
  });
  it('requires explicit response basis and effective column booleans/source identity', () => {
    for (const data of [
      { ...basisResponse, businessBasis: undefined },
      { ...basisResponse, sourceId: 2 },
      { ...basisResponse, businessColumns: [{ name: 'code', type: 'INTEGER', numeric: 'false', temporal: false }] },
    ]) {
      expect(() => readBusinessBasis({ data: { status: 'SUCCESS', data } }, 1)).toThrow();
    }
    expect(() => readBusinessBasis({ data: { status: 'ERROR', data: basisResponse } }, 1)).toThrow();
  });
});
