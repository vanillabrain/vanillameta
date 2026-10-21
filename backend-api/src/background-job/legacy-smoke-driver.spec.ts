// Loading pure helpers must not run the HTTP/Redis smoke or create fixture files.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const driver = require('../../../scripts/qa-main-legacy.cjs');

describe('legacy smoke driver input boundaries', () => {
  it('requires an explicit runtime and rejects unrecognized flags', () => {
    expect(() => driver.parseArgs([])).toThrow();
    expect(() => driver.parseArgs(['runtime.json', '--force'])).toThrow();
    expect(() => driver.parseArgs(['one.json', 'two.json'])).toThrow();
    expect(driver.parseArgs(['runtime.json', '--no-redis']).noRedis).toBe(true);
    expect(driver.parseArgs(['runtime.json']).noRedis).toBe(false);
  });
  it('unwraps HTTP data envelopes while preserving native SQL result objects', () => {
    expect(driver.unwrap({ status: 'SUCCESS', data: { id: 1 } })).toEqual({ id: 1 });
    const result = { status: 'SUCCESS', datas: [{ total: 600 }] };
    expect(driver.unwrap(result)).toBe(result);
  });
  it('accepts only a simple table identifier returned by upload', () => {
    expect(driver.identifier('source')).toBe('"source"');
    for (const value of [undefined, 'source;DROP TABLE x', '../source', 'source"'])
      expect(() => driver.identifier(value)).toThrow();
  });
});
