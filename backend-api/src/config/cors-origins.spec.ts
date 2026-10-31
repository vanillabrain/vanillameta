import { resolveCorsOrigins } from './cors-origins';

describe('resolveCorsOrigins', () => {
  it('lets the browser use either loopback spelling in local development', () => {
    expect(resolveCorsOrigins('http://localhost:3000', 'local')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
    expect(resolveCorsOrigins('http://127.0.0.1:3000', 'development')).toEqual([
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]);
  });

  it('preserves configured origins without widening production', () => {
    expect(resolveCorsOrigins('https://app.example.test', 'production')).toEqual([
      'https://app.example.test',
    ]);
    expect(resolveCorsOrigins('https://app.example.test', 'prod')).toEqual([
      'https://app.example.test',
    ]);
  });

  it('keeps an explicitly configured local origin and removes duplicates', () => {
    expect(resolveCorsOrigins('http://localhost:3000, http://localhost:3000', 'local')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });
});
