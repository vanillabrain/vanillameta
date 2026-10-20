jest.mock('../utils/crypto.util', () => ({ decryptConnectionConfig: (v: string) => v }));
import { createHash } from 'crypto';
import { studioDemoData } from '../dashboard-studio/studio-demo-data';
import { trustedReuseCurrency, assertReuseCurrency } from './reuse-units';
const source = (id: 'margin' | 'margin-reuse' | 'margin-krw') => {
  const sha256 = createHash('sha256').update(studioDemoData(id).csv).digest('hex');
  return {
    engine: 'duckdb',
    description: `studio-sample:vm-${id}-v1-${sha256}`,
    connectionConfig: JSON.stringify({
      connection: { filename: '/fixture' },
      fileVersions: [{ filename: '/fixture', sha256 }],
    }),
  } as any;
};
it('pins exact current fixture metadata, not source names or currency text', () => {
  expect(trustedReuseCurrency(source('margin'))).toBe('USD');
  expect(trustedReuseCurrency(source('margin-reuse'))).toBe('USD');
  expect(trustedReuseCurrency(source('margin-krw'))).toBe('KRW');
  expect(trustedReuseCurrency({ ...source('margin'), description: 'USD' })).toBeUndefined();
  const s = source('margin');
  const c = JSON.parse(s.connectionConfig);
  c.connection.filename = '/replaced';
  expect(trustedReuseCurrency({ ...s, connectionConfig: JSON.stringify(c) })).toBeUndefined();
});
it('blocks known currency mismatch even with confirmation and requires confirmation for unknown uploads', () => {
  expect(() => assertReuseCurrency('USD', 'KRW', 'same-unit')).toThrow('금액');
  expect(() => assertReuseCurrency('USD', undefined)).toThrow('자동으로 확인');
  expect(() => assertReuseCurrency('USD', undefined, 'same-unit')).not.toThrow();
  expect(() => assertReuseCurrency('USD', 'USD')).not.toThrow();
  expect(() => assertReuseCurrency(undefined, undefined, 'other')).toThrow();
});
