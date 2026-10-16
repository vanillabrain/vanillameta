import { DataSource } from 'typeorm';
import { User } from './user.entity';

it('creates users with driver-managed creation and update timestamps', async () => {
  const db = await new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User],
    synchronize: true,
  }).initialize();
  try {
    const saved = await db.manager.save(User, {
      userId: 'timestamp-fixture',
      email: 'timestamps@example.invalid',
      password: 'fixture-hash',
    });
    const reloaded = await db.manager.findOneByOrFail(User, { id: saved.id });
    expect(reloaded.userId).toBe('timestamp-fixture');
    expect(Number.isFinite(reloaded.createdAt.getTime())).toBe(true);
    expect(Number.isFinite(reloaded.updatedAt.getTime())).toBe(true);
  } finally {
    await db.destroy();
  }
});
