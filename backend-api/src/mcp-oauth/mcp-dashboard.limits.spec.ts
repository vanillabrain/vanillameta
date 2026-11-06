import { ActorWindowLimiter } from './mcp-dashboard.limits';

describe('ActorWindowLimiter', () => {
  it('counts per account and bucket and starts a new window when one ends', () => {
    let now = 0;
    const limiter = new ActorWindowLimiter(() => now);
    for (let i = 0; i < 2; i += 1) limiter.take(1, 'a', 2, 1000);
    expect(expectThrown(() => limiter.take(1, 'a', 2, 1000))).toMatchObject({
      code: 'LIMIT',
      reason: 'RATE_LIMITED',
    });
    limiter.take(2, 'a', 2, 1000);
    limiter.take(1, 'b', 2, 1000);
    now = 1000;
    limiter.take(1, 'a', 2, 1000);
  });

  it("clearing old entries never shortens another bucket's longer window", () => {
    let now = 0;
    const limiter = new ActorWindowLimiter(() => now);
    limiter.take(1, 'hourly', 1, 3_600_000);
    // Over 10,000 short windows trigger the cleanup, called with a one-minute length.
    for (let actor = 100; actor < 10_200; actor += 1) limiter.take(actor, 'minute', 1, 60_000);
    now = 120_000;
    limiter.take(999_999, 'minute', 1, 60_000);
    expect(() => limiter.take(1, 'hourly', 1, 3_600_000)).toThrow();
  });
});

function expectThrown(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}
