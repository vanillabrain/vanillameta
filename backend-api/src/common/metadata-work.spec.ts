import { serializeMetadataWork } from './metadata-work';
import { DataSource } from 'typeorm';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
const db = () => ({ options: { type: 'sqlite' } } as DataSource);

describe('NFR005/008 metadata operation scopes', () => {
  it('composes awaited nested operations without blocking itself and recovers after failure', async () => {
    const connection = db();
    expect(
      await serializeMetadataWork(connection, () =>
        serializeMetadataWork(connection, async () => 42),
      ),
    ).toBe(42);
    await expect(
      serializeMetadataWork(connection, async () => {
        throw new Error('expected');
      }),
    ).rejects.toThrow('expected');
    expect(await serializeMetadataWork(connection, async () => 43)).toBe(43);
  });
  it('does not block an independent connection or a non-SQLite driver', async () => {
    const a = db(),
      b = db(),
      entered = gate(),
      release = gate();
    const first = serializeMetadataWork(a, async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    try {
      expect(await serializeMetadataWork(b, async () => true)).toBe(true);
      expect(
        await serializeMetadataWork({ options: { type: 'mysql' } } as DataSource, async () => true),
      ).toBe(true);
    } finally {
      release.resolve();
      await first;
    }
  });
  it('does not let detached work re-enter after its parent operation has ended', async () => {
    const connection = db(),
      fire = gate(),
      held = gate(),
      release = gate();
    let detached: Promise<void>,
      started = false;
    await serializeMetadataWork(connection, async () => {
      detached = (async () => {
        await fire.promise;
        await serializeMetadataWork(connection, async () => {
          started = true;
        });
      })();
    });
    const blocker = serializeMetadataWork(connection, async () => {
      held.resolve();
      await release.promise;
    });
    await held.promise;
    fire.resolve();
    await new Promise(resolve => setImmediate(resolve));
    const bypassed = started;
    release.resolve();
    await Promise.all([blocker, detached]);
    expect(bypassed).toBe(false);
    expect(started).toBe(true);
  });
});
