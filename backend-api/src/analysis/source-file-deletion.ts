import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

async function checkDirectory(target: string) {
  const stat = await fs.lstat(target, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await fs.realpath(target)) !== target)
    throw new Error();
  return stat;
}

async function checkRoot(root: string) {
  // Check every ancestor, including root; realpath alone follows symlinks.
  let ancestor = path.parse(root).root;
  await checkDirectory(ancestor);
  for (const part of root.slice(ancestor.length).split(path.sep).filter(Boolean)) {
    ancestor = path.join(ancestor, part);
    await checkDirectory(ancestor);
  }
}

type FileIdentity = { device: string; inode: string };
const identity = (stat: { dev: bigint; ino: bigint }): FileIdentity => ({
  device: String(stat.dev),
  inode: String(stat.ino),
});
const sameIdentity = (a: FileIdentity, b: FileIdentity) =>
  !!a && !!b && a.device === b.device && a.inode === b.inode;
const patterns = {
  duckdb: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[\\/]data\.duckdb$/,
  sqlite: /^sample-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.db$/,
};

/** Internal canonical path only; never put the returned path in a public response. */
export async function resolveDeletionFilename(
  root: string,
  filename: string,
  kind: keyof typeof patterns,
) {
  const lexicalRoot = path.resolve(root);
  const relative = path.relative(lexicalRoot, path.resolve(filename));
  if (!patterns[kind].test(relative)) throw new Error();
  // A backslash is a literal filename character on POSIX, never a directory separator.
  if (
    kind === 'duckdb' &&
    (relative.split(path.sep).length !== 2 || path.basename(relative) !== 'data.duckdb')
  )
    throw new Error();
  const configured = await fs.lstat(lexicalRoot, { bigint: true });
  if (!configured.isDirectory() || configured.isSymbolicLink()) throw new Error();
  let ancestor = path.parse(lexicalRoot).root;
  for (const part of lexicalRoot.slice(ancestor.length).split(path.sep).filter(Boolean)) {
    ancestor = path.join(ancestor, part);
    const stat = await fs.lstat(ancestor);
    if (
      stat.isSymbolicLink() &&
      !(
        process.platform === 'darwin' &&
        ['/var', '/tmp', '/etc'].includes(ancestor) &&
        (await fs.realpath(ancestor)) === '/private' + ancestor
      )
    )
      throw new Error();
  }
  root = await fs.realpath(lexicalRoot);
  await checkRoot(root);
  const rootStat = await checkDirectory(root);
  if (!sameIdentity(identity(configured), identity(rootStat))) throw new Error();
  return { root, filename: path.join(root, relative), rootIdentity: identity(rootStat) };
}

/** Server-only evidence. Never accept this object from a client or expose its digest. */
export type DeletionImportProof =
  | {
      version: 1;
      state: 'owned';
      /** Hash of parsed manifest excluding only databaseId and updatedAt. */
      manifestDigest: string;
      manifestDatabaseId: number | null;
      fileIdentity: FileIdentity | null;
      sourceId: number | null;
      filenameDigest: string;
      rootIdentity: FileIdentity;
      directoryIdentity: FileIdentity;
    }
  | {
      version: 1;
      state: 'missing';
      sourceId: number | null;
      filenameDigest: string;
      rootIdentity: FileIdentity;
    };

/** Metadata-only checks, shared with the worker so authorization is checked at removal time.
 * The managed root must be writable only by trusted application code. Node's path-based rm
 * cannot defend against a hostile same-UID process swapping entries between checks and rm.
 */
export async function inspectDeletionImport(
  root: string,
  filename: string,
  sourceId: number | undefined,
  options: {
    allowUnregistered?: boolean;
    proof?: DeletionImportProof;
    allowMissing?: boolean;
    /** Cleanup only: recover the marker-unlinked/rmdir crash window with a captured identity. */
    allowEmptyWithoutManifest?: boolean;
  } = {},
): Promise<DeletionImportProof> {
  try {
    if (sourceId !== undefined && (!Number.isSafeInteger(sourceId) || sourceId <= 0))
      throw new Error();
    const canonical = await resolveDeletionFilename(root, filename, 'duckdb');
    root = canonical.root;
    const resolved = canonical.filename;
    const directory = path.dirname(resolved);
    if (
      options.proof &&
      (options.proof.version !== 1 ||
        options.proof.sourceId !== (sourceId ?? null) ||
        options.proof.filenameDigest !== createHash('sha256').update(resolved).digest('hex') ||
        !sameIdentity(options.proof.rootIdentity, canonical.rootIdentity))
    )
      throw new Error();
    let directoryStat;
    try {
      directoryStat = await checkDirectory(directory);
    } catch (error) {
      if (error.code === 'ENOENT' && options.allowMissing)
        return {
          version: 1,
          state: 'missing',
          sourceId: sourceId ?? null,
          filenameDigest: createHash('sha256').update(resolved).digest('hex'),
          rootIdentity: canonical.rootIdentity,
        };
      throw error;
    }
    if (options.proof?.state === 'missing') throw new Error();
    if (options.proof && !sameIdentity(options.proof.directoryIdentity, identity(directoryStat)))
      throw new Error();
    const checkTree = async (target: string) => {
      for (const name of await fs.readdir(target)) {
        const entry = path.join(target, name);
        const stat = await fs.lstat(entry);
        if (stat.isSymbolicLink()) throw new Error();
        if (stat.isDirectory()) {
          await checkDirectory(entry);
          await checkTree(entry);
        } else if (!stat.isFile() || (await fs.realpath(entry)) !== entry) throw new Error();
      }
    };
    await checkTree(directory);
    const dataStat = await fs.lstat(resolved, { bigint: true }).catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (dataStat && (!dataStat.isFile() || dataStat.isSymbolicLink())) throw new Error();
    if (
      dataStat &&
      options.proof?.state === 'owned' &&
      !sameIdentity(options.proof.fileIdentity, identity(dataStat))
    )
      throw new Error();
    // The database file may already be absent after a partial cleanup. The manifest must
    // still prove ownership of this exact directory; an empty/unknown directory is denied.
    const current = await checkDirectory(directory);
    if (current.dev !== directoryStat.dev || current.ino !== directoryStat.ino) throw new Error();
    await checkDirectory(root);
    const handle = await fs
      .open(path.join(directory, 'import.json'), constants.O_RDONLY | constants.O_NOFOLLOW)
      .catch(async error => {
        if (
          error.code === 'ENOENT' &&
          options.allowEmptyWithoutManifest &&
          options.proof?.state === 'owned' &&
          sameIdentity(options.proof.directoryIdentity, identity(current)) &&
          (await fs.readdir(directory)).length === 0
        )
          return undefined;
        throw error;
      });
    // No children can be removed under this exception. Only the exact empty captured
    // directory may be rmdir'd after the manifest-unlink/process-interruption gap.
    if (!handle) return options.proof;
    let raw: Buffer;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error();
      raw = await handle.readFile();
    } finally {
      await handle.close();
    }
    const manifest = JSON.parse(raw.toString('utf8'));
    if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') throw new Error();
    const stableManifest = { ...manifest };
    delete stableManifest.databaseId;
    delete stableManifest.updatedAt;
    const digest = createHash('sha256').update(JSON.stringify(stableManifest)).digest('hex');
    const manifestDatabaseId = Object.prototype.hasOwnProperty.call(manifest, 'databaseId')
      ? manifest.databaseId
      : null;
    if (Object.prototype.hasOwnProperty.call(manifest, 'databaseId')) {
      if (sourceId === undefined || manifest.databaseId !== sourceId) throw new Error();
    } else if (!options.allowUnregistered && !options.proof) throw new Error();
    if (!['ready', 'validation_failed'].includes(manifest.status)) throw new Error();
    if (
      options.proof &&
      (options.proof.version !== 1 ||
        options.proof.state !== 'owned' ||
        options.proof.manifestDigest !== digest ||
        (options.proof.manifestDatabaseId !== null &&
          options.proof.manifestDatabaseId !== manifestDatabaseId) ||
        options.proof.sourceId !== (sourceId ?? null) ||
        options.proof.filenameDigest !== createHash('sha256').update(resolved).digest('hex'))
    )
      throw new Error();
    return {
      version: 1,
      state: 'owned',
      manifestDigest: digest,
      manifestDatabaseId,
      fileIdentity: dataStat ? identity(dataStat) : null,
      sourceId: sourceId ?? null,
      filenameDigest: createHash('sha256').update(resolved).digest('hex'),
      rootIdentity: canonical.rootIdentity,
      directoryIdentity: identity(current),
    };
  } catch {
    // Filesystem/JSON errors can contain private paths or manifest content.
    throw new BadRequestException('managed import deletion validation failed');
  }
}

/** Worker cleanup keeps ownership evidence until every other child has gone. The final
 * unlink/rmdir gap is recoverable only with the captured identity and an empty directory.
 */
export async function removeDeletionImport(
  root: string,
  filename: string,
  sourceId: number | undefined,
  proof?: DeletionImportProof,
): Promise<void> {
  try {
    const checked = await inspectDeletionImport(root, filename, sourceId, {
      proof,
      allowMissing: true,
      allowEmptyWithoutManifest: true,
    });
    if (checked.state === 'missing') return;
    const canonical = await resolveDeletionFilename(root, filename, 'duckdb');
    const directory = path.dirname(canonical.filename);
    const guard = async () => {
      const current = await resolveDeletionFilename(root, filename, 'duckdb');
      if (
        !sameIdentity(current.rootIdentity, checked.rootIdentity) ||
        !sameIdentity(identity(await checkDirectory(directory)), checked.directoryIdentity)
      )
        throw new Error();
    };
    const removeChild = async (entry: string): Promise<void> => {
      const stat = await fs.lstat(entry, { bigint: true });
      if (stat.isSymbolicLink() || (await fs.realpath(entry)) !== entry) throw new Error();
      if (entry === canonical.filename && !sameIdentity(checked.fileIdentity, identity(stat)))
        throw new Error();
      if (stat.isDirectory()) {
        for (const name of (await fs.readdir(entry)).sort())
          await removeChild(path.join(entry, name));
        const current = await checkDirectory(entry);
        if (!sameIdentity(identity(stat), identity(current))) throw new Error();
        await guard();
        await fs.rmdir(entry);
      } else {
        if (!stat.isFile()) throw new Error();
        const current = await fs.lstat(entry, { bigint: true });
        if (!current.isFile() || !sameIdentity(identity(stat), identity(current)))
          throw new Error();
        await guard();
        await fs.unlink(entry);
      }
    };
    await guard();
    for (const name of (await fs.readdir(directory)).sort()) {
      if (name === 'import.json') continue;
      // Any missing-marker directory containing children fails here, before deletion.
      await inspectDeletionImport(root, filename, sourceId, { proof: checked });
      await removeChild(path.join(directory, name));
    }
    await guard();
    const remaining = await fs.readdir(directory);
    if (remaining.length) {
      if (remaining.length !== 1 || remaining[0] !== 'import.json') throw new Error();
      await inspectDeletionImport(root, filename, sourceId, { proof: checked });
      await guard();
      const marker = path.join(directory, 'import.json');
      const markerStat = await fs.lstat(marker);
      if (
        !markerStat.isFile() ||
        markerStat.isSymbolicLink() ||
        (await fs.realpath(marker)) !== marker
      )
        throw new Error();
      await fs.unlink(marker);
    }
    await guard();
    // Never recurse after the marker is gone. Unexpected children make rmdir fail closed.
    await fs.rmdir(directory);
  } catch {
    throw new BadRequestException('managed import deletion validation failed');
  }
}

/** Opaque server-only evidence. SourceCore authorizes this proof because SQLite samples
 * have no filesystem Source ownership manifest. Never accept it from a client.
 */
export type DeletionSqliteProof = {
  version: 1;
  kind: 'sqlite-sample';
  sourceId: number;
  filenameDigest: string;
  rootIdentity: FileIdentity;
  state: 'owned' | 'missing';
  file: { device: string; inode: string; headerDigest: string } | null;
  companions: Partial<Record<'-wal' | '-shm' | '-journal', { device: string; inode: string }>>;
};
const sqliteCompanions = ['-wal', '-shm', '-journal'] as const;
const filenameDigest = (filename: string) => createHash('sha256').update(filename).digest('hex');

async function sqlitePath(root: string, filename: string, sourceId: number) {
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) throw new Error();
  return resolveDeletionFilename(root, filename, 'sqlite');
}

async function sqliteIdentity(filename: string, database = false) {
  let stat;
  try {
    stat = await fs.lstat(filename, { bigint: true });
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || (await fs.realpath(filename)) !== filename)
    throw new Error();
  const identity = { device: stat.dev.toString(), inode: stat.ino.toString() };
  if (!database) return identity;
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat({ bigint: true });
    if (!current.isFile() || current.dev !== stat.dev || current.ino !== stat.ino)
      throw new Error();
    const header = Buffer.alloc(100);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const pageSize = header.readUInt16BE(16);
    if (
      bytesRead !== 100 ||
      !header.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')) ||
      !(
        pageSize === 1 ||
        (pageSize >= 512 && pageSize <= 32768 && (pageSize & (pageSize - 1)) === 0)
      ) ||
      ![1, 2].includes(header[18]) ||
      ![1, 2].includes(header[19])
    )
      throw new Error();
    // Only hash the immutable SQLite signature. Closing/checkpointing can change the
    // other header fields after preflight; dev/inode bind proof to the original file.
    return {
      ...identity,
      headerDigest: createHash('sha256').update(header.subarray(0, 16)).digest('hex'),
    };
  } finally {
    await handle.close();
  }
}

/** Metadata-only filesystem preflight: no writes or Knex/Source DB access. */
export async function inspectDeletionSqlite(
  root: string,
  filename: string,
  sourceId: number,
): Promise<DeletionSqliteProof> {
  try {
    const canonical = await sqlitePath(root, filename, sourceId);
    filename = canonical.filename;
    const file = await sqliteIdentity(filename, true);
    if (file && !('headerDigest' in file)) throw new Error();
    const companions: DeletionSqliteProof['companions'] = {};
    for (const suffix of sqliteCompanions) {
      const identity = await sqliteIdentity(filename + suffix);
      if (identity) companions[suffix] = identity;
    }
    return {
      version: 1,
      kind: 'sqlite-sample',
      rootIdentity: canonical.rootIdentity,
      sourceId,
      filenameDigest: filenameDigest(filename),
      state: file ? 'owned' : 'missing',
      file: file && 'headerDigest' in file ? file : null,
      companions,
    };
  } catch {
    throw new BadRequestException('managed SQLite deletion validation failed');
  }
}

/** Main must have closed Knex before this worker-queued cleanup. Never recurse. */
export async function removeDeletionSqlite(
  root: string,
  filename: string,
  sourceId: number,
  proof: DeletionSqliteProof,
): Promise<void> {
  try {
    const canonical = await sqlitePath(root, filename, sourceId);
    filename = canonical.filename;
    if (
      !proof ||
      proof.version !== 1 ||
      proof.kind !== 'sqlite-sample' ||
      proof.sourceId !== sourceId ||
      proof.filenameDigest !== filenameDigest(filename) ||
      !sameIdentity(proof.rootIdentity, canonical.rootIdentity) ||
      !['owned', 'missing'].includes(proof.state) ||
      (proof.state === 'missing' && proof.file !== null) ||
      (proof.state === 'owned' &&
        (!proof.file ||
          !/^[0-9]+$/.test(proof.file.device) ||
          !/^[0-9]+$/.test(proof.file.inode) ||
          !/^[0-9a-f]{64}$/.test(proof.file.headerDigest))) ||
      !proof.companions ||
      Object.keys(proof.companions).some(key => !sqliteCompanions.includes(key as any))
    )
      throw new Error();
    const matching = (
      current: { device: string; inode: string },
      expected: { device: string; inode: string },
    ) => !!expected && current.device === expected.device && current.inode === expected.inode;
    const checkDatabase = async () => {
      const current = await sqliteIdentity(filename, true);
      if (
        current &&
        (proof.state === 'missing' ||
          !matching(current, proof.file) ||
          !('headerDigest' in current) ||
          current.headerDigest !== proof.file.headerDigest)
      )
        throw new Error();
      return current;
    };
    await checkDatabase();
    // Validate every companion before any unlink: foreign/symlink entries cause zero deletion.
    for (const suffix of sqliteCompanions) {
      const current = await sqliteIdentity(filename + suffix);
      if (current && !matching(current, proof.companions[suffix])) throw new Error();
    }
    for (const suffix of sqliteCompanions) {
      const current = await sqliteIdentity(filename + suffix);
      if (!current) continue;
      if (!matching(current, proof.companions[suffix])) throw new Error();
      await fs.unlink(filename + suffix);
    }
    if (await checkDatabase()) await fs.unlink(filename);
  } catch {
    throw new BadRequestException('managed SQLite deletion validation failed');
  }
}
