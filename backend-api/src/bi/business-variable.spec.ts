import { businessVariable, classificationRef } from './business-variable';

describe('UC050 business variable declaration', () => {
  const ref = { organizationId: 1, id: 2, version: 3 };
  it('preserves historical references and linked text on omission, and detaches without renaming', () => {
    const previous = businessVariable({ classification: 'Pinned name', classificationRef: ref });
    expect(businessVariable({}, previous)).toEqual(previous);
    expect(businessVariable({ classificationRef: { ...ref } }, previous)).toEqual(previous);
    expect(() => businessVariable({ classification: 'Changed' }, previous)).toThrow();
    expect(() =>
      businessVariable({ classificationRef: null, classification: 'Changed' }, previous),
    ).toThrow();
    const detached = businessVariable({ classificationRef: null }, previous);
    expect(detached).toMatchObject({ classification: 'Pinned name', classificationRef: null });
    expect(businessVariable({ classification: 'Free text' }, detached)).toMatchObject({
      classification: 'Free text',
      classificationRef: null,
    });
    expect(
      businessVariable({ classification: 'New' }, businessVariable({ classification: 'Old' })),
    ).toMatchObject({ classification: 'New' });
  });
  it.each([
    undefined,
    [],
    { organizationId: 1, id: 2 },
    { ...ref, version: 0 },
    { ...ref, version: 2147483648 },
    { ...ref, id: '2' },
    { ...ref, organizationId: -1 },
    { ...ref, extra: true },
    { ...ref, id: 1.5 },
  ])('rejects malformed classification history instead of dropping it: %j', value => {
    expect(() => classificationRef(value)).toThrow();
  });
  it('copies canonical reference fields without mutating input or evaluating accessors', () => {
    const input = { ...ref };
    expect(classificationRef(input)).toEqual(ref);
    expect(classificationRef(input)).not.toBe(input);
    const get = jest.fn(() => 2);
    const accessor = Object.defineProperty({ ...ref }, 'id', { get });
    expect(() => classificationRef(accessor)).toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it('preserves omitted saved values while explicit auto and empty reset them', () => {
    const previous = businessVariable(
      { businessType: 'date', dateFormat: 'YYYY-MM-DD', classification: '결제' },
      undefined,
      'VARCHAR',
    );
    expect(businessVariable({}, previous, 'VARCHAR')).toEqual(previous);
    expect(
      businessVariable(
        { businessType: 'auto', dateFormat: '', classification: '' },
        previous,
        'VARCHAR',
      ),
    ).toEqual({ businessType: 'auto', dateFormat: '', classification: '' });
    expect(businessVariable({ classification: ' Ａ ' })).toMatchObject({ classification: 'A' });
  });
  it.each([
    ['VARCHAR', { businessType: 'number' }],
    ['INTEGER', { businessType: 'date', dateFormat: 'YYYYMMDD' }],
    ['DATE', { businessType: 'date', dateFormat: 'YYYY-MM-DD' }],
    ['VARCHAR', { businessType: 'date', dateFormat: 'native' }],
    ['VARCHAR', { businessType: 'date' }],
    ['VARCHAR', { businessType: 'auto', dateFormat: 'native' }],
    ['STRUCT(x INTEGER)', { businessType: 'category' }],
    ['DOUBLE[]', { businessType: 'number' }],
    ['BLOB', { businessType: 'category' }],
    ['VARCHAR', { businessType: 'oops' }],
    ['VARCHAR', { classification: null }],
    ['VARCHAR', { classification: 'a'.repeat(81) }],
    ['VARCHAR', { classification: 'a\u0000b' }],
  ])('rejects incompatible or invalid declaration: %s %j', (type, value) => {
    expect(() => businessVariable(value, undefined, type)).toThrow();
  });
  it.each(['DECIMAL(18,2)', 'UBIGINT', 'DOUBLE'])('accepts actual numeric type %s', type => {
    expect(businessVariable({ businessType: 'number' }, undefined, type).businessType).toBe(
      'number',
    );
  });
});
