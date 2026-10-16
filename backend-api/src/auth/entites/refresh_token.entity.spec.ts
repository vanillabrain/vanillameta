import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { RefreshToken } from './refresh_token.entity';

it('persists a signed refresh token longer than the default varchar limit', async () => {
  const db = await new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [RefreshToken],
    synchronize: true,
  }).initialize();
  try {
    const jwt = new JwtService({ secret: 'test-only-refresh-token-secret' });
    const token = jwt.sign(
      {
        refreshKeyData: {
          userId: 'vmmysqlverify',
          email: 'mysql-verification@example.invalid',
          id: 1,
        },
      },
      { expiresIn: '43200s', jwtid: 'test-refresh-session-id' },
    );
    expect(token.length).toBeGreaterThan(255);
    const saved = await db.manager.save(RefreshToken, { refreshToken: token });
    const reloaded = await db.manager.findOneByOrFail(RefreshToken, { id: saved.id });
    expect(reloaded.refreshToken).toBe(token);
    expect(jwt.verify(reloaded.refreshToken).refreshKeyData.id).toBe(1);
  } finally {
    await db.destroy();
  }
});
