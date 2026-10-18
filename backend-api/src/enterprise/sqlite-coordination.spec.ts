jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { StudioService } from '../dashboard-studio/studio.service';
import { serializeEnterpriseWrite } from './enterprise-write';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};

describe('NFR005/008 cross-module SQLite transaction boundary', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
    await db.query('CREATE TABLE probe (id integer PRIMARY KEY, value integer)');
    await db.query('INSERT INTO probe VALUES (1,0)');
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('does not acknowledge an enterprise write inside a Studio transaction that later rolls back', async () => {
    const entered = gate(),
      release = gate();
    const studio = new StudioService(db, {} as any, {} as any, {} as any);
    const first = studio.serializeWrite(() =>
      db.transaction(async manager => {
        await manager.query('UPDATE probe SET value=1 WHERE id=1');
        entered.resolve();
        await release.promise;
        throw new Error('expected Studio rollback');
      }),
    );
    // Observe the rejection immediately even while the deliberate transaction gate is held.
    const settledFirst = first.catch(error => error);
    await entered.promise;
    let secondAcknowledged = false;
    const second = serializeEnterpriseWrite(db, () =>
      db.transaction(async manager => {
        await manager.query('UPDATE probe SET value=2 WHERE id=1');
      }),
    ).then(() => {
      secondAcknowledged = true;
    });
    let acknowledgedBeforeRelease: boolean;
    try {
      await Promise.race([second, new Promise(resolve => setTimeout(resolve, 150))]);
      acknowledgedBeforeRelease = secondAcknowledged;
    } finally {
      release.resolve();
      await Promise.all([settledFirst, second]);
    }
    const finalValue = (await db.query('SELECT value FROM probe WHERE id=1'))[0].value;
    expect({ acknowledgedBeforeRelease, finalValue }).toEqual({
      acknowledgedBeforeRelease: false,
      finalValue: 2,
    });
  });
});
