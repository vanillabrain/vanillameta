// Queue-registration tests isolate application modules; full DI/runtime belongs to main.
jest.mock('../dataset/dataset.module', () => ({ DatasetModule: class DatasetModule {} }));
jest.mock('../database/database.module', () => ({ DatabaseModule: class DatabaseModule {} }));
jest.mock('../connection/connection.module', () => ({
  ConnectionModule: class ConnectionModule {},
}));
jest.mock('../common/logger/logger.module', () => ({ LoggerModule: class LoggerModule {} }));
import { ConfigModule, ConfigService } from '@nestjs/config';
import { backgroundJobRuntime } from './background-job.module';
import { QueryJobProcessor } from './processors/query-job.processor';
import { BackgroundJobService } from './background-job.service';

// Inspect registration metadata only. This suite must never connect to Redis.
describe('legacy queue explicit configuration', () => {
  const keys = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT'];
  let original: Record<string, string | undefined>;
  beforeAll(async () => {
    await ConfigModule.forRoot({ ignoreEnvFile: true });
  });
  beforeEach(() => {
    original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
  });
  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('keeps history service but omits Bull and worker when no Redis is configured', async () => {
    const module = await backgroundJobRuntime();
    expect(module.providers).toContain(BackgroundJobService);
    expect(module.providers).not.toContain(QueryJobProcessor);
    expect(module.imports.some((item: any) => item?.module?.name === 'BullModule')).toBe(false);
  });

  it.each(keys)('registers the worker when %s is explicitly configured', async key => {
    process.env[key] =
      key === 'REDIS_PORT'
        ? '16379'
        : key === 'REDIS_URL'
        ? 'redis://127.0.0.1:16379'
        : '127.0.0.1';
    const module = await backgroundJobRuntime();
    expect(module.providers).toContain(QueryJobProcessor);
    const bull: any = module.imports.find((item: any) => item?.module?.name === 'BullModule');
    expect(bull).toBeDefined();
    const optionsProvider = bull.providers.find(
      (provider: any) =>
        typeof provider.useFactory === 'function' && provider.inject?.includes(ConfigService),
    );
    const options = await optionsProvider.useFactory(
      { getDependencyRef: () => ({}) },
      new ConfigService(),
    );
    if (key === 'REDIS_URL') expect(options.redis).toBe(process.env.REDIS_URL);
    if (key === 'REDIS_PORT') expect(options.redis.port).toBe(16379);
  });
});
