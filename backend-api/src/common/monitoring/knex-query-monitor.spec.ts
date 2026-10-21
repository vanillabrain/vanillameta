import { KnexQueryMonitor } from './knex-query-monitor';

describe('Knex query timing', () => {
  afterEach(() => jest.restoreAllMocks());

  function fixture() {
    const events = new Map<string, (...args: any[]) => any>();
    const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const slow = { logSlowQuery: jest.fn() };
    const analyzer = { analyzeQuery: jest.fn().mockResolvedValue({ query: 'SELECT 1' }) };
    const monitor = new KnexQueryMonitor(log as any, slow as any, analyzer as any);
    monitor.attachToKnex({ on: (name, handler) => events.set(name, handler) } as any, 1, 'mysql2');
    return { events, slow, analyzer, log };
  }

  it('correlates cloned Knex events by query UID and isolates concurrent queries', async () => {
    const f = fixture();
    const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
    f.events.get('query')({ sql: 'SELECT 1', __knexQueryUid: 'a' });
    now.mockReturnValue(100100);
    f.events.get('query')({ sql: 'SELECT 2', __knexQueryUid: 'b' });
    now.mockReturnValue(101500);
    await f.events.get('query-response')([], { sql: 'SELECT 1', __knexQueryUid: 'a' });
    expect(f.slow.logSlowQuery).toHaveBeenCalledWith(
      expect.objectContaining({ executionTime: 1500 }),
      expect.anything(),
    );
    now.mockReturnValue(101600);
    await f.events.get('query-response')([], { sql: 'SELECT 2', __knexQueryUid: 'b' });
    expect(f.slow.logSlowQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ executionTime: 1500 }),
      expect.anything(),
    );
  });

  it('does not invent an epoch-sized duration for unmatched or duplicate terminal events', async () => {
    const f = fixture();
    jest.spyOn(Date, 'now').mockReturnValue(1761000000000);
    await f.events.get('query-response')([], { sql: 'SELECT 1', __knexQueryUid: 'missing' });
    expect(f.analyzer.analyzeQuery).not.toHaveBeenCalled();
    f.events.get('query')({ sql: 'SELECT 1', __knexQueryUid: 'a' });
    f.events.get('query-error')(new Error('synthetic'), { sql: 'SELECT 1', __knexQueryUid: 'a' });
    await f.events.get('query-response')([], { sql: 'SELECT 1', __knexQueryUid: 'a' });
    expect(f.analyzer.analyzeQuery).not.toHaveBeenCalled();
  });
});
