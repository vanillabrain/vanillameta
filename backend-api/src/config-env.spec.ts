import { ConfigModule } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { apiEnvFiles } from './config-env';

describe('API environment files', () => {
  const key = 'VM_LOCAL_CONFIG_TEST';
  let directory: string;
  const previous = process.env[key];

  beforeEach(async () => {
    delete process.env[key];
    directory = await mkdtemp(join(tmpdir(), 'vm-local-config-'));
  });
  afterEach(async () => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    await rm(directory, { recursive: true, force: true });
  });

  it('keeps development and production file selection unchanged', () => {
    expect(apiEnvFiles('dev')).toEqual(['.env.dev']);
    expect(apiEnvFiles(undefined)).toEqual(['.env.dev']);
    expect(apiEnvFiles('prod')).toEqual(['.env']);
  });

  const load = () =>
    ConfigModule.forRoot({ envFilePath: apiEnvFiles('local').map(file => join(directory, file)) });

  it('loads local settings before development defaults', async () => {
    await writeFile(join(directory, '.env.local'), `${key}=local\n`);
    await writeFile(join(directory, '.env.dev'), `${key}=development\n`);
    await load();
    expect(process.env[key]).toBe('local');
  });

  it('uses development defaults when the local file is absent', async () => {
    await writeFile(join(directory, '.env.dev'), `${key}=development\n`);
    await load();
    expect(process.env[key]).toBe('development');
  });

  it('preserves explicit shell settings over both files', async () => {
    process.env[key] = 'shell';
    await writeFile(join(directory, '.env.local'), `${key}=local\n`);
    await writeFile(join(directory, '.env.dev'), `${key}=development\n`);
    await load();
    expect(process.env[key]).toBe('shell');
  });
});
