import { DuckDBService, DeletionImportProof } from './duckdb.service';
import { removeDeletionImport } from './source-file-deletion';
import mutableFs, * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as sqlite3 from 'sqlite3';

describe('source file deletion using isolated temporary fixtures', () => {
  let service: DuckDBService;
  let fixture: string;
  let root: string;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  const denial = 'managed import deletion validation failed';
  const sourceId = 71;
  const manifestPath = (filename: string) => path.join(path.dirname(filename), 'import.json');

  beforeEach(async () => {
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'source-delete-')));
    root = path.join(fixture, 'uploads');
    await fs.mkdir(root);
    process.env.FILE_UPLOAD_DIR = root;
    service = new DuckDBService();
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    // Only this test's mkdtemp tree is removed, never application/user storage.
    await fs.rm(fixture, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });
  async function imported(registered = true) {
    const result = await service.importFile({
      originalname: 'fixture.csv',
      buffer: Buffer.from('n\n1\n2\n'),
    });
    if (registered) await service.registerImport(result.filename, sourceId);
    return result.filename;
  }
  async function absent(filename: string) {
    await expect(fs.lstat(path.dirname(filename))).rejects.toMatchObject({ code: 'ENOENT' });
  }
  async function activeQuery(filename: string) {
    const query = service.query(filename, 'SELECT sum(i) AS n FROM range(200000000) t(i)');
    // Observe real dispatch instead of relying on query()'s asynchronous fs.access.
    for (let tries = 0; (service as any).active?.kind !== 'query'; tries++) {
      if (tries > 1000) throw new Error('query was not dispatched');
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    return { query };
  }
  it('does metadata-only preflight, waits for a real worker query, removes and retries', async () => {
    const filename = await imported();
    const original = await fs.readFile(manifestPath(filename));
    const proof = await service.validateDeletionImport(filename, sourceId);
    expect(proof).toMatchObject({
      version: 1,
      state: 'owned',
      manifestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await fs.readFile(manifestPath(filename))).toEqual(original);
    const { query } = await activeQuery(filename);
    let queryFinished = false;
    const observed = query.then(result => {
      queryFinished = true;
      return result;
    });
    const removal = service.removeOwnedImport(filename, sourceId, proof);
    await fs.access(filename);
    expect((service as any).active.kind).toBe('query');
    await removal;
    expect(queryFinished).toBe(true);
    expect((await observed).datas).toEqual([{ n: '19999999900000000' }]);
    await absent(filename);
    await service.removeOwnedImport(filename, sourceId, proof);
    await service.removeOwnedImport(filename, sourceId);
    await expect(service.validateDeletionImport(filename, sourceId)).rejects.toThrow(denial);
  });
  it('requires explicit trusted proof for an unregistered saved Source without writing its manifest', async () => {
    const filename = await imported(false);
    await expect(service.validateDeletionImport(filename, sourceId)).rejects.toThrow(denial);
    await expect(service.removeOwnedImport(filename, sourceId)).rejects.toThrow(denial);
    const original = await fs.readFile(manifestPath(filename));
    const proof = await service.validateDeletionImport(filename, sourceId, {
      allowUnregistered: true,
    });
    expect(await fs.readFile(manifestPath(filename))).toEqual(original);
    await service.removeOwnedImport(filename, sourceId, proof);
    await absent(filename);
  });
  it.each([true, false])(
    'rechecks current ownership inside queued worker (registered=%s)',
    async registered => {
      const filename = await imported(registered);
      const proof = await service.validateDeletionImport(filename, sourceId, {
        allowUnregistered: !registered,
      });
      const { query } = await activeQuery(filename);
      const removal = service.removeOwnedImport(filename, sourceId, proof);
      const rejected = expect(removal).rejects.toThrow(denial);
      await fs.writeFile(
        manifestPath(filename),
        JSON.stringify({ status: 'ready', databaseId: 99 }),
      );
      await query;
      await rejected;
      await fs.access(filename);
    },
  );
  it('binds unregistered proof to the exact Source and managed filename', async () => {
    const filename = await imported(false);
    const proof = await service.validateDeletionImport(filename, sourceId, {
      allowUnregistered: true,
    });
    await expect(service.removeOwnedImport(filename, sourceId + 1, proof)).rejects.toThrow(denial);
    const other = path.join(root, randomUUID(), 'data.duckdb');
    await fs.mkdir(path.dirname(other));
    await fs.copyFile(filename, other);
    await fs.copyFile(manifestPath(filename), manifestPath(other));
    await expect(service.removeOwnedImport(other, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
    await fs.access(other);
  });
  it('performs preflight without starting a worker and denies unknown directory contents', async () => {
    const filename = path.join(root, randomUUID(), 'data.duckdb');
    await fs.mkdir(path.dirname(filename));
    await fs.writeFile(filename, 'fixture');
    await fs.writeFile(
      manifestPath(filename),
      JSON.stringify({ status: 'ready', databaseId: sourceId }),
    );
    const original = await fs.stat(manifestPath(filename));
    await service.validateDeletionImport(filename, sourceId);
    expect((service as any).worker).toBeUndefined();
    expect((await fs.stat(manifestPath(filename))).mtimeMs).toBe(original.mtimeMs);
    await fs.unlink(manifestPath(filename));
    await expect(service.removeOwnedImport(filename, sourceId)).rejects.toThrow(denial);
    expect(await fs.readFile(filename, 'utf8')).toBe('fixture');
  });
  it('rejects a symlink introduced while removal waits for the worker query', async () => {
    const filename = await imported();
    const proof = await service.validateDeletionImport(filename, sourceId);
    const { query } = await activeQuery(filename);
    const removal = service.removeOwnedImport(filename, sourceId, proof);
    const rejected = expect(removal).rejects.toThrow(denial);
    await fs.symlink(fixture, path.join(path.dirname(filename), 'spill-link'));
    await query;
    await rejected;
    await fs.access(filename);
  });
  it('revokes temporary cleanup even if auxiliary registration fails', async () => {
    const filename = await imported(false);
    const write = jest
      .spyOn(service as any, 'manifest')
      .mockRejectedValue(new Error('fixture registration failure'));
    await expect(service.registerImport(filename, sourceId)).rejects.toThrow(
      'managed import registration validation failed',
    );
    write.mockRestore();
    await expect(service.removeImport(filename)).rejects.toThrow(denial);
    await expect(service.discardImport(filename)).rejects.toThrow(denial);
    await fs.unlink(filename);
    const proof = await service.validateDeletionImport(filename, sourceId, {
      allowUnregistered: true,
    });
    await service.removeOwnedImport(filename, sourceId, proof);
    await absent(filename);
  });
  it('rejects a changed unregistered digest', async () => {
    const filename = await imported(false);
    const proof = await service.validateDeletionImport(filename, sourceId, {
      allowUnregistered: true,
    });
    await fs.writeFile(manifestPath(filename), JSON.stringify({ status: 'ready', rows: 3 }));
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('can clean partial data-file removal with remaining manifest ownership', async () => {
    const filename = await imported();
    await fs.unlink(filename);
    const proof = await service.validateDeletionImport(filename, sourceId);
    await service.removeOwnedImport(filename, sourceId, proof);
    await absent(filename);
  });
  it.each(['foreign', 'unknown', 'malformed', 'unregistered', 'absent'])(
    'denies %s manifests and preserves files',
    async kind => {
      const filename = await imported();
      if (kind === 'absent') await fs.unlink(manifestPath(filename));
      else
        await fs.writeFile(
          manifestPath(filename),
          kind === 'malformed'
            ? '{private'
            : JSON.stringify(
                kind === 'foreign'
                  ? { status: 'ready', databaseId: 99 }
                  : kind === 'unregistered'
                  ? { status: 'ready' }
                  : { databaseId: sourceId },
              ),
        );
      await expect(service.validateDeletionImport(filename, sourceId)).rejects.toThrow(denial);
      await expect(service.removeOwnedImport(filename, sourceId)).rejects.toThrow(denial);
      await fs.access(filename);
    },
  );
  it.each(['root', 'ancestor', 'directory', 'data', 'manifest', 'nested'])(
    'denies %s symlinks',
    async kind => {
      let filename = await imported();
      const directory = path.dirname(filename);
      const proof = await service.validateDeletionImport(filename, sourceId);
      if (kind === 'root') {
        await fs.rename(root, path.join(fixture, 'real'));
        await fs.symlink(path.join(fixture, 'real'), root);
      } else if (kind === 'ancestor') {
        const alias = path.join(fixture, 'alias');
        await fs.symlink(fixture, alias);
        process.env.FILE_UPLOAD_DIR = path.join(alias, 'uploads');
        filename = path.join(alias, 'uploads', path.basename(directory), 'data.duckdb');
      } else if (kind === 'directory') {
        const other = path.join(fixture, 'other');
        await fs.rename(directory, other);
        await fs.symlink(other, directory);
      } else if (kind === 'nested') await fs.symlink(fixture, path.join(directory, 'spill'));
      else {
        const target = kind === 'data' ? filename : manifestPath(filename);
        const other = path.join(fixture, kind);
        await fs.rename(target, other);
        await fs.symlink(other, target);
      }
      await expect(service.validateDeletionImport(filename, sourceId)).rejects.toThrow(denial);
      await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
      await fs.access(filename);
    },
  );
  it('denies root, escaping/non UUID paths and invalid source IDs without exposing paths', async () => {
    const filename = await imported();
    for (const candidate of [
      root,
      path.join(root, 'data.duckdb'),
      path.join(fixture, randomUUID(), 'data.duckdb'),
      path.join(root, '-'.repeat(36), 'data.duckdb'),
      path.join(root, [randomUUID(), 'data.duckdb'].join(String.fromCharCode(92))),
    ]) {
      for (const action of [
        () => service.validateDeletionImport(candidate, sourceId),
        () => service.removeOwnedImport(candidate, sourceId),
      ]) {
        const error = await action().catch(error => error);
        expect(error.message).toBe(denial);
        expect(error.message).not.toContain(fixture);
      }
    }
    for (const id of [0, -1, NaN, 1.5, undefined]) {
      await expect(service.validateDeletionImport(filename, id)).rejects.toThrow(denial);
      await expect(service.removeOwnedImport(filename, id)).rejects.toThrow(denial);
    }
    await fs.access(filename);
  });
  it('an explicitly allowed missing proof supports cleanup retries but denies any newly present directory', async () => {
    const filename = await imported();
    const held = path.join(fixture, 'held-directory');
    await fs.rename(path.dirname(filename), held);
    await expect(service.validateDeletionImport(filename, sourceId)).rejects.toThrow(denial);
    const proof: DeletionImportProof = await service.validateDeletionImport(filename, sourceId, {
      allowMissing: true,
      allowUnregistered: true,
    });
    expect(proof).toMatchObject({
      version: 1,
      state: 'missing',
      sourceId,
      filenameDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      rootIdentity: { device: expect.any(String), inode: expect.any(String) },
    });
    await service.removeOwnedImport(filename, sourceId, proof);
    await service.removeOwnedImport(filename, sourceId, proof);
    await expect(service.removeOwnedImport(filename, sourceId + 1, proof)).rejects.toThrow(denial);
    await fs.rename(held, path.dirname(filename));
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('permits only unchanged unregistered to exact-owner auxiliary registration after deletion preflight', async () => {
    const filename = await imported(false);
    const proof = await service.validateDeletionImport(filename, sourceId, {
      allowUnregistered: true,
    });
    await service.registerImport(filename, sourceId);
    const registered = await service.validateDeletionImport(filename, sourceId);
    expect(
      registered.state === 'owned' &&
        proof.state === 'owned' &&
        registered.manifestDigest === proof.manifestDigest,
    ).toBe(true);
    await service.removeOwnedImport(filename, sourceId, proof);
    await absent(filename);
  });
  it('rejects a replaced data file even with identical manifest and directory', async () => {
    const filename = await imported();
    const proof = await service.validateDeletionImport(filename, sourceId);
    const held = path.join(fixture, 'held.duckdb');
    await fs.rename(filename, held);
    await fs.copyFile(held, filename);
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('rejects removal of an established manifest owner and any non-auxiliary field change', async () => {
    const filename = await imported();
    const proof = await service.validateDeletionImport(filename, sourceId);
    const original = JSON.parse(await fs.readFile(manifestPath(filename), 'utf8'));
    const changed = { ...original };
    delete changed.databaseId;
    await fs.writeFile(manifestPath(filename), JSON.stringify(changed));
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.writeFile(manifestPath(filename), JSON.stringify({ ...original, rows: 99 }));
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('same-owner registration is read-only and foreign registration never rebinds', async () => {
    const filename = await imported();
    const original = await fs.readFile(manifestPath(filename));
    await service.registerImport(filename, sourceId);
    await expect(service.registerImport(filename, sourceId + 1)).rejects.toThrow(
      'managed import registration validation failed',
    );
    expect(await fs.readFile(manifestPath(filename))).toEqual(original);
  });
  it('registration rejects original-proof drift/foreign ownership without modifying the manifest', async () => {
    for (const foreign of [false, true]) {
      const filename = await imported(false);
      const original = JSON.parse(await fs.readFile(manifestPath(filename), 'utf8'));
      const raw = JSON.stringify(
        foreign ? { ...original, databaseId: sourceId + 1 } : { ...original, rows: 99 },
      );
      await fs.writeFile(manifestPath(filename), raw);
      await expect(service.registerImport(filename, sourceId)).rejects.toThrow(
        'managed import registration validation failed',
      );
      expect(await fs.readFile(manifestPath(filename), 'utf8')).toBe(raw);
      await expect(service.discardImport(filename)).rejects.toThrow(denial);
    }
  });
  it('serializes registration ownership and allows the same Source to retry an auxiliary write failure', async () => {
    const filename = await imported(false);
    const write = jest
      .spyOn(service as any, 'manifest')
      .mockRejectedValueOnce(new Error('private fixture failure'));
    await expect(service.registerImport(filename, sourceId)).rejects.toThrow(
      'managed import registration validation failed',
    );
    write.mockRestore();
    await expect(service.registerImport(filename, sourceId + 1)).rejects.toThrow(
      'managed import registration validation failed',
    );
    const results = await Promise.allSettled([
      service.registerImport(filename, sourceId),
      service.registerImport(filename, sourceId),
      service.registerImport(filename, sourceId + 1),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
    expect(JSON.parse(await fs.readFile(manifestPath(filename), 'utf8')).databaseId).toBe(sourceId);
  });
  it('accepts the actual os.tmpdir OS ancestor alias but rejects replacement root/UUID identities', async () => {
    const aliasFixture = await fs.mkdtemp(path.join(os.tmpdir(), 'source-alias-'));
    try {
      process.env.FILE_UPLOAD_DIR = aliasFixture;
      const filename = await imported();
      const proof = await service.validateDeletionImport(filename, sourceId);
      await service.removeOwnedImport(filename, sourceId, proof);
      await expect(fs.lstat(path.dirname(filename))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.rm(aliasFixture, { recursive: true, force: true });
      process.env.FILE_UPLOAD_DIR = root;
    }
    const filename = await imported();
    const proof = await service.validateDeletionImport(filename, sourceId);
    await fs.rename(path.dirname(filename), path.join(fixture, 'old-directory'));
    await fs.cp(path.join(fixture, 'old-directory'), path.dirname(filename), { recursive: true });
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('pins the configured root identity even if the original UUID directory is moved back', async () => {
    const filename = await imported();
    const proof = await service.validateDeletionImport(filename, sourceId);
    const oldRoot = path.join(fixture, 'original-root');
    await fs.rename(root, oldRoot);
    await fs.mkdir(root);
    await fs.rename(
      path.join(oldRoot, path.basename(path.dirname(filename))),
      path.dirname(filename),
    );
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
  });
  it('keeps the marker through interrupted child cleanup and finishes after a worker restart', async () => {
    const filename = await imported();
    const directory = path.dirname(filename);
    const first = path.join(directory, '00-first.txt');
    const blocked = path.join(directory, 'zz-interrupted.txt');
    await fs.writeFile(first, 'owned fixture');
    await fs.writeFile(blocked, 'owned fixture');
    await fs.mkdir(path.join(directory, 'spill', 'nested'), { recursive: true });
    await fs.writeFile(path.join(directory, 'spill', 'nested', 'owned.txt'), 'owned spill');
    const proof = await service.validateDeletionImport(filename, sourceId);
    const marker = await fs.readFile(manifestPath(filename));
    const unlink = fs.unlink;
    const fault = jest.spyOn(mutableFs, 'unlink').mockImplementation(async (entry: string) => {
      if (entry === blocked)
        throw Object.assign(new Error('fixture interruption'), { code: 'EIO' });
      // At every ordinary child unlink, the untouched ownership marker must remain.
      if (entry.startsWith(directory + path.sep) && entry !== manifestPath(filename))
        expect(await fs.readFile(manifestPath(filename))).toEqual(marker);
      return unlink(entry);
    });
    try {
      await expect(removeDeletionImport(root, filename, sourceId, proof)).rejects.toThrow(denial);
    } finally {
      fault.mockRestore();
    }
    await expect(fs.lstat(first)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(path.join(directory, 'spill'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(manifestPath(filename))).toEqual(marker);
    await fs.access(blocked);
    await service.onModuleDestroy();
    service = new DuckDBService();
    await service.removeOwnedImport(filename, sourceId, JSON.parse(JSON.stringify(proof)));
    await absent(filename);
  });
  it('retries the marker-unlinked/rmdir interruption only for the exact captured empty directory', async () => {
    const filename = await imported();
    const directory = path.dirname(filename);
    const proof = await service.validateDeletionImport(filename, sourceId);
    const rmdir = fs.rmdir;
    const fault = jest.spyOn(mutableFs, 'rmdir').mockImplementation(async (entry: string) => {
      if (entry === directory)
        throw Object.assign(new Error('fixture interruption'), { code: 'EIO' });
      return rmdir(entry);
    });
    try {
      await expect(removeDeletionImport(root, filename, sourceId, proof)).rejects.toThrow(denial);
    } finally {
      fault.mockRestore();
    }
    expect(await fs.readdir(directory)).toEqual([]);
    await expect(
      service.validateDeletionImport(filename, sourceId, { allowMissing: true }),
    ).rejects.toThrow(denial);
    await expect(service.removeOwnedImport(filename, sourceId)).rejects.toThrow(denial);
    await service.onModuleDestroy();
    service = new DuckDBService();
    await service.removeOwnedImport(filename, sourceId, JSON.parse(JSON.stringify(proof)));
    await absent(filename);
    await service.removeOwnedImport(filename, sourceId, proof);
  });
  it('denies a replacement empty directory after the marker-unlinked interruption', async () => {
    const filename = await imported();
    const directory = path.dirname(filename);
    const proof = await service.validateDeletionImport(filename, sourceId);
    const rmdir = fs.rmdir;
    const fault = jest.spyOn(mutableFs, 'rmdir').mockImplementation(async (entry: string) => {
      if (entry === directory)
        throw Object.assign(new Error('fixture interruption'), { code: 'EIO' });
      return rmdir(entry);
    });
    try {
      await expect(removeDeletionImport(root, filename, sourceId, proof)).rejects.toThrow(denial);
    } finally {
      fault.mockRestore();
    }
    expect(await fs.readdir(directory)).toEqual([]);
    await fs.rename(directory, path.join(fixture, 'captured-empty-directory'));
    await fs.mkdir(directory);
    await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
    expect(await fs.readdir(directory)).toEqual([]);
  });
  it.each(['file', 'directory', 'symlink'])(
    'never removes a missing-marker directory containing a %s, even with captured proof',
    async kind => {
      const filename = await imported();
      const directory = path.dirname(filename);
      const proof = await service.validateDeletionImport(filename, sourceId);
      // Simulate an old interrupted cleanup within this test-owned fixture only.
      for (const name of await fs.readdir(directory))
        await fs.rm(path.join(directory, name), { recursive: true, force: true });
      const child = path.join(directory, 'unknown-child');
      if (kind === 'file') await fs.writeFile(child, 'preserve');
      else if (kind === 'directory') await fs.mkdir(child);
      else await fs.symlink(fixture, child);
      await expect(service.removeOwnedImport(filename, sourceId, proof)).rejects.toThrow(denial);
      await fs.lstat(child);
    },
  );
  it('legacy remove/discard cannot bypass registered or foreign ownership', async () => {
    const registered = await imported();
    await expect(service.removeImport(registered)).rejects.toThrow(denial);
    await expect(service.discardImport(registered)).rejects.toThrow(denial);
    await expect(
      (service as any).submit({ kind: 'remove', filename: registered }, 10000),
    ).rejects.toThrow(denial);
    await expect(
      service.validateDeletionImport(registered, sourceId + 1, { allowUnregistered: true }),
    ).rejects.toThrow(denial);
    const temporary = await imported(false);
    await fs.writeFile(
      manifestPath(temporary),
      JSON.stringify({ status: 'ready', databaseId: 99 }),
    );
    await expect(service.removeImport(temporary)).rejects.toThrow(denial);
    await expect(service.discardImport(temporary)).rejects.toThrow(denial);
    await fs.access(temporary);
    const settled = await imported(false);
    await service.discardImport(settled);
    await absent(settled);
  });
});

describe('managed sample SQLite cleanup with real temporary databases', () => {
  let service: DuckDBService;
  let fixture: string;
  let root: string;
  let closers: Array<() => Promise<void>>;
  const savedRoot = process.env.FILE_UPLOAD_DIR;
  const sourceId = 81;
  const denial = 'managed SQLite deletion validation failed';
  const suffixes = ['-wal', '-shm', '-journal'] as const;
  beforeEach(async () => {
    // Preserve the real macOS os.tmpdir alias for explicit root canonicalization coverage.
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-delete-'));
    root = path.join(fixture, 'uploads');
    await fs.mkdir(root);
    process.env.FILE_UPLOAD_DIR = root;
    service = new DuckDBService();
    closers = [];
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    for (const close of closers) await close();
    await fs.rm(fixture, { recursive: true, force: true });
    if (savedRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = savedRoot;
  });
  async function sample(wal = false) {
    const filename = path.join(root, `sample-${randomUUID()}.db`);
    const db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const connection = new sqlite3.Database(filename, error =>
        error ? reject(error) : resolve(connection),
      );
    });
    let closed = false;
    const close = async () => {
      if (closed) return;
      await new Promise<void>((resolve, reject) =>
        db.close(error => (error ? reject(error) : resolve())),
      );
      closed = true;
    };
    closers.push(close);
    await new Promise<void>((resolve, reject) =>
      db.exec(
        `${
          wal ? 'PRAGMA journal_mode=WAL;' : ''
        } CREATE TABLE fixture(n INTEGER); INSERT INTO fixture VALUES (1);`,
        error => (error ? reject(error) : resolve()),
      ),
    );
    if (!wal) await close();
    return { filename, close };
  }
  it('preflights read-only with OS root alias, deletes only exact DB/owned sidecars and retries', async () => {
    const { filename } = await sample();
    for (const suffix of suffixes)
      await fs.writeFile(filename + suffix, 'owned temporary companion');
    const unrelated = path.join(root, 'keep.txt');
    await fs.writeFile(unrelated, 'keep');
    const before = await fs.readFile(filename);
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    expect(proof).toMatchObject({
      version: 1,
      kind: 'sqlite-sample',
      sourceId,
      file: {
        device: expect.any(String),
        inode: expect.any(String),
        headerDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect((service as any).worker).toBeUndefined();
    expect(await fs.readFile(filename)).toEqual(before);
    await service.removeOwnedSqlite(filename, sourceId, proof);
    for (const name of [filename, ...suffixes.map(suffix => filename + suffix)])
      await expect(fs.lstat(name)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(unrelated, 'utf8')).toBe('keep');
    await service.removeOwnedSqlite(filename, sourceId, proof);
    expect(await service.validateDeletionSqlite(filename, sourceId)).toMatchObject({
      state: 'missing',
      file: null,
    });
  });
  it('supports initially missing exact sample DB metadata cleanup and repeated retries', async () => {
    const filename = path.join(root, `sample-${randomUUID()}.db`);
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    expect(proof).toMatchObject({
      version: 1,
      kind: 'sqlite-sample',
      state: 'missing',
      file: null,
      sourceId,
      companions: {},
    });
    expect((service as any).worker).toBeUndefined();
    await service.removeOwnedSqlite(filename, sourceId, proof);
    await service.removeOwnedSqlite(filename, sourceId, proof);
    await expect(fs.lstat(filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('missing proof refuses any new DB or uncaptured companion before cleanup', async () => {
    const { filename } = await sample();
    const held = path.join(fixture, 'original.db');
    await fs.rename(filename, held);
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    await fs.rename(held, filename);
    await expect(service.removeOwnedSqlite(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.rename(filename, held);
    await fs.writeFile(filename + '-wal', 'new foreign companion');
    await expect(service.removeOwnedSqlite(filename, sourceId, proof)).rejects.toThrow(denial);
    expect(await fs.readFile(filename + '-wal', 'utf8')).toBe('new foreign companion');
  });
  it('missing DB proof captures only existing companion identities', async () => {
    const filename = path.join(root, `sample-${randomUUID()}.db`);
    await fs.writeFile(filename + '-journal', 'captured orphan companion');
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    expect(proof.state).toBe('missing');
    expect(proof.companions['-journal']).toMatchObject({
      device: expect.any(String),
      inode: expect.any(String),
    });
    await service.removeOwnedSqlite(filename, sourceId, proof);
    await service.removeOwnedSqlite(filename, sourceId, proof);
    await expect(fs.lstat(filename + '-journal')).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('allows the close/checkpoint between preflight and cleanup, without requiring mutable header bytes', async () => {
    const { filename, close } = await sample(true);
    await fs.access(filename + '-wal');
    await fs.access(filename + '-shm');
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    await close(); // Main must await removeKnex before cleanup; real SQLite shutdown checkpoints WAL.
    await service.removeOwnedSqlite(filename, sourceId, proof);
    await expect(fs.lstat(filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('waits behind a real worker query', async () => {
    const { filename } = await sample();
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    const imported = await service.importFile({
      originalname: 'fixture.csv',
      buffer: Buffer.from('n\n1\n'),
    });
    const query = service.query(imported.filename, 'SELECT sum(i) AS n FROM range(200000000) t(i)');
    for (let tries = 0; (service as any).active?.kind !== 'query'; tries++) {
      if (tries > 1000) throw new Error('worker query not dispatched');
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    let done = false;
    const observed = query.then(() => {
      done = true;
    });
    const removal = service.removeOwnedSqlite(filename, sourceId, proof);
    await fs.access(filename);
    expect((service as any).active.kind).toBe('query');
    await removal;
    expect(done).toBe(true);
    await observed;
  });
  it.each(['source', 'filename', 'inode', 'header', 'proof'])(
    'rejects a changed %s proof/target without deleting',
    async kind => {
      let { filename } = await sample();
      let proof = await service.validateDeletionSqlite(filename, sourceId);
      let id = sourceId;
      if (kind === 'source') id++;
      else if (kind === 'filename') {
        const other = await sample();
        filename = other.filename;
      } else if (kind === 'inode') {
        await fs.rename(filename, path.join(fixture, 'original.db'));
        await fs.copyFile(path.join(fixture, 'original.db'), filename);
      } else if (kind === 'header') {
        const handle = await fs.open(filename, 'r+');
        try {
          await handle.write(Buffer.alloc(16), 0, 16, 0);
        } finally {
          await handle.close();
        }
      } else proof = undefined;
      await expect(service.removeOwnedSqlite(filename, id, proof)).rejects.toThrow(denial);
      await fs.access(filename);
    },
  );
  it.each(['-wal', '-shm', '-journal'] as const)(
    'rejects a foreign/replaced companion %s before deleting anything',
    async suffix => {
      const { filename } = await sample();
      await fs.writeFile(filename + suffix, 'owned');
      const proof = await service.validateDeletionSqlite(filename, sourceId);
      await fs.rename(filename + suffix, path.join(fixture, 'original-companion'));
      await fs.writeFile(filename + suffix, 'foreign');
      await expect(service.removeOwnedSqlite(filename, sourceId, proof)).rejects.toThrow(denial);
      await fs.access(filename);
      expect(await fs.readFile(filename + suffix, 'utf8')).toBe('foreign');
    },
  );
  it('denies a new companion not captured by preflight; can retry after partial base disappearance', async () => {
    const { filename } = await sample();
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    await fs.writeFile(filename + '-journal', 'new foreign companion');
    await expect(service.removeOwnedSqlite(filename, sourceId, proof)).rejects.toThrow(denial);
    await fs.access(filename);
    const current = await service.validateDeletionSqlite(filename, sourceId);
    await fs.unlink(filename);
    await service.removeOwnedSqlite(filename, sourceId, current);
    await expect(fs.lstat(filename + '-journal')).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['root', 'database', '-wal', '-shm', '-journal'])(
    'denies %s symlinks with no file deletion',
    async kind => {
      const { filename } = await sample();
      const proof = await service.validateDeletionSqlite(filename, sourceId);
      if (kind === 'root') {
        await fs.rename(root, path.join(fixture, 'real-root'));
        await fs.symlink(path.join(fixture, 'real-root'), root);
      } else if (kind === 'database') {
        const original = path.join(fixture, 'original.db');
        await fs.rename(filename, original);
        await fs.symlink(original, filename);
      } else await fs.symlink(filename, filename + kind);
      await expect(service.validateDeletionSqlite(filename, sourceId)).rejects.toThrow(denial);
      await expect(service.removeOwnedSqlite(filename, sourceId, proof)).rejects.toThrow(denial);
      await fs.access(filename);
    },
  );
  it('rejects external/arbitrary SQLite paths, invalid headers, and directories without path disclosure', async () => {
    const { filename } = await sample();
    const proof = await service.validateDeletionSqlite(filename, sourceId);
    for (const candidate of [
      root,
      path.join(root, 'external.db'),
      path.join(fixture, `sample-${randomUUID()}.db`),
      path.join(root, 'sample-' + '-'.repeat(36) + '.db'),
    ]) {
      await expect(service.validateDeletionSqlite(candidate, sourceId)).rejects.toThrow(denial);
      const error = await service
        .removeOwnedSqlite(candidate, sourceId, proof)
        .catch(error => error);
      expect(error.message).toBe(denial);
      expect(error.message).not.toContain(fixture);
    }
    const invalid = path.join(root, `sample-${randomUUID()}.db`);
    await fs.writeFile(invalid, 'not a SQLite database');
    await expect(service.validateDeletionSqlite(invalid, sourceId)).rejects.toThrow(denial);
    await fs.unlink(invalid);
    await fs.mkdir(invalid);
    await expect(service.validateDeletionSqlite(invalid, sourceId)).rejects.toThrow(denial);
    await fs.access(filename);
  });
});
