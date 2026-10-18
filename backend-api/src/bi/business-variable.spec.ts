import { businessVariable } from './business-variable';

describe('UC050 business variable declaration', () => {
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
