import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';

describe('owned semantic MySQL gate before any schema mutation', () => {
  let dir: string, file: string;
  const previous = {
    config: process.env.VM_SEMANTIC_MYSQL_CONFIG,
    owner: process.env.VM_SEMANTIC_MYSQL_OWNER,
  };
  const owner = 'a'.repeat(24);
  const config = () => ({
    gate: 'owned-semantic-mysql-v1',
    owner,
    host: '127.0.0.1',
    port: 33060,
    username: 'root',
    password: 'unused-test-value',
    databasePrefix: 'vm_semantic_' + owner,
    serverUuid: 'owned-server',
  });
  const options = { type: 'sqlite' as const, database: ':memory:' };
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-semantic-gate-'));
    file = path.join(dir, 'config.json');
    fs.writeFileSync(file, JSON.stringify(config()), { mode: 0o600 });
    process.env.VM_SEMANTIC_MYSQL_CONFIG = file;
    process.env.VM_SEMANTIC_MYSQL_OWNER = owner;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
    for (const [key, value] of [
      ['VM_SEMANTIC_MYSQL_CONFIG', previous.config],
      ['VM_SEMANTIC_MYSQL_OWNER', previous.owner],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it.each(['host', 'owner', 'databasePrefix', 'port'] as const)(
    'rejects invalid %s without connecting',
    async field => {
      const bad: any = config();
      bad[field] = field === 'port' ? 3306.5 : 'unowned';
      fs.writeFileSync(file, JSON.stringify(bad));
      const initialize = jest
        .spyOn(DataSource.prototype, 'initialize')
        .mockRejectedValue(new Error('Must not connect'));
      await expect(semanticMetadata('studio', options)).rejects.toThrow('non-owned');
      expect(initialize).not.toHaveBeenCalled();
    },
  );
  it.each(['public-mode', 'symlink'])('rejects %s config before connecting', async kind => {
    if (kind === 'public-mode') fs.chmodSync(file, 0o644);
    else {
      const link = path.join(dir, 'link.json');
      fs.symlinkSync(file, link);
      process.env.VM_SEMANTIC_MYSQL_CONFIG = link;
    }
    const initialize = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockRejectedValue(new Error('Must not connect'));
    await expect(semanticMetadata('runtime', options)).rejects.toThrow('Private regular');
    expect(initialize).not.toHaveBeenCalled();
  });
  it.each(['uuid', 'marker'])('rejects wrong %s and disconnects before synchronize', async kind => {
    const synchronize = jest.fn(),
      destroy = jest.fn().mockResolvedValue(undefined);
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          version: '8.4.11',
          uuid: kind === 'uuid' ? 'wrong' : 'owned-server',
          db: 'vm_semantic_' + owner + '_studio',
        },
      ])
      .mockResolvedValueOnce([{ token: 'wrong' }]);
    jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockResolvedValue({ options: { type: 'mysql' }, query, synchronize, destroy } as any);
    await expect(semanticMetadata('studio', options)).rejects.toThrow(
      kind === 'uuid' ? 'Unexpected' : 'Unowned',
    );
    expect(synchronize).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
