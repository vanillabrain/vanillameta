import { constants } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { CommerceSource } from '../commerce/entities/commerce-source.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { parseConnectionConfig } from '../utils/crypto.util';
import { inspectDeletionSqlite, resolveDeletionFilename } from '../analysis/source-file-deletion';
import { handoverStorage } from './handover-dependencies';

const fileEngines = ['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'];
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp = (stat: any) =>
  [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.mode].map(String);
const inode = (stat: any) => `${stat.dev}:${stat.ino}`;
const root = () => path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads');
type Capture = {
  requestedFilename: string;
  filename: string;
  kind: 'duckdb' | 'sqlite';
  signature: string;
  inodes: string[];
  hardlink: boolean;
};

/** Bounded metadata only. Values stay internal and are never returned by the endpoint. */
export async function custodyMetadata(manager: EntityManager) {
  const databases = await manager.find(Database, {
    select: { id: true, engine: true, connectionConfig: true },
    order: { id: 'ASC' },
    take: 2001,
  });
  const commerce =
    databases.length > 2000
      ? []
      : await manager.find(CommerceSource, {
          select: { publishedFilename: true, id: true },
          order: { id: 'ASC' },
          take: 2001 - databases.length,
        });
  const metadataDatabase = (manager.connection.options as { database?: unknown }).database;
  const trustedMetadataFile =
    manager.connection.options.type === 'sqlite' &&
    typeof metadataDatabase === 'string' &&
    metadataDatabase !== ':memory:'
      ? path.resolve(metadataDatabase)
      : null;
  return {
    databases,
    commerce,
    limited: databases.length + commerce.length > 2000,
    trustedMetadataFile,
  };
}
export async function custodyRefresh(manager: EntityManager, sourceId: number) {
  const rows = await manager.find(FileRefresh, {
    where: { sourceId },
    select: { status: true, leaseToken: true, leaseUntil: true },
    take: 2001,
  });
  return rows.length > 2000 ||
    rows.some(
      row =>
        row.leaseToken !== null ||
        row.leaseUntil !== null ||
        !['succeeded', 'failed', 'interrupted', 'cancelled'].includes(row.status),
    )
    ? ('active_or_unresolved' as const)
    : ('none_observed' as const);
}
function filenames(config: any): string[] {
  if (
    !object(config) ||
    typeof config.connection?.filename !== 'string' ||
    !config.connection.filename
  )
    throw new Error();
  const versions = config.fileVersions;
  if (
    versions !== undefined &&
    (!Array.isArray(versions) ||
      !versions.length ||
      versions.length > 5 ||
      versions.some(v => !object(v) || typeof v.filename !== 'string' || !v.filename))
  )
    throw new Error();
  const rawFiles = [config.connection.filename, ...(versions ?? []).map(v => v.filename)];
  if (rawFiles.some(filename => filename.length > 4096 || filename.split(/[\\/]/).length > 32))
    throw new Error();
  const files = [
    ...new Set<string>(
      [config.connection.filename, ...(versions ?? []).map(v => v.filename)].map(f =>
        path.resolve(f),
      ),
    ),
  ];
  if (files.length < 1 || files.length > 5) throw new Error();
  return files;
}
async function regular(filename: string) {
  const stat = await fs.lstat(filename, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  return stat;
}
async function capture(
  filename: string,
  kind: Capture['kind'],
  sourceId: number,
): Promise<Capture> {
  const requestedFilename = filename;
  const canonical = await resolveDeletionFilename(root(), filename, kind);
  filename = canonical.filename;
  const rootStat = await fs.lstat(canonical.root, { bigint: true });
  const values: unknown[] = [canonical.rootIdentity];
  const stats: any[] = [];
  if (kind === 'sqlite') {
    const proof = await inspectDeletionSqlite(canonical.root, filename, sourceId);
    if (proof.state !== 'owned' || !proof.file) throw new Error();
    values.push(proof);
    stats.push(await regular(filename));
    for (const suffix of ['-wal', '-shm', '-journal']) {
      try {
        stats.push(await regular(filename + suffix));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  } else {
    const directory = path.dirname(filename),
      directoryStat = await fs.lstat(directory, { bigint: true });
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error();
    const data = await regular(filename),
      marker = path.join(directory, 'import.json'),
      markerStat = await regular(marker);
    if (markerStat.size > BigInt(1024 * 1024)) throw new Error();
    const handle = await fs.open(marker, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat({ bigint: true });
      if (digest(stamp(opened)) !== digest(stamp(markerStat))) throw new Error();
      const buffer = Buffer.alloc(1024 * 1024 + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 1024 * 1024) throw new Error();
      const raw = buffer.subarray(0, length);
      const manifest = JSON.parse(raw.toString('utf8'));
      if (!object(manifest) || manifest.status !== 'ready' || manifest.databaseId !== sourceId)
        throw new Error();
      values.push(digest(raw.toString('utf8')));
      if (digest(stamp(await handle.stat({ bigint: true }))) !== digest(stamp(markerStat)))
        throw new Error();
    } finally {
      await handle.close();
    }
    if (
      digest(stamp(await fs.lstat(directory, { bigint: true }))) !== digest(stamp(directoryStat)) ||
      digest(stamp(await regular(marker))) !== digest(stamp(markerStat))
    )
      throw new Error();
    values.push(stamp(directoryStat), stamp(markerStat));
    stats.push(data);
  }
  if (inode(rootStat) !== `${canonical.rootIdentity.device}:${canonical.rootIdentity.inode}`)
    throw new Error();
  values.push(...stats.map(stamp));
  return {
    requestedFilename,
    filename,
    kind,
    signature: digest(values),
    inodes: stats.map(inode),
    hardlink: stats.some(stat => stat.nlink > BigInt(1)),
  };
}

/** lstat only, beneath a checked managed root and shape; never follows arbitrary consumer paths. */
async function consumerPath(filename: string, trustedMetadataFile?: string | null) {
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename.length > 4096 ||
    filename.split(/[\\/]/).length > 32
  )
    throw new Error();
  const relative = path.relative(root(), path.resolve(filename));
  const duck = new RegExp(`^(${uuid})${path.sep === '/' ? '/' : '\\\\'}(.+)$`).exec(relative);
  const sqlite = new RegExp(`^(sample-${uuid}\\.db)(?:-wal|-shm|-journal)?$`).exec(relative);
  const kind = duck ? 'duckdb' : sqlite ? 'sqlite' : null;
  if (!kind) {
    // The bootstrap seed explicitly references this server's metadata SQLite file.
    // Exact server configuration only: no owner/id exemption or arbitrary outside path.
    if (
      !trustedMetadataFile ||
      !['', '-wal', '-shm', '-journal'].some(
        s => path.resolve(filename) === trustedMetadataFile + s,
      )
    )
      throw new Error();
    const target = path.resolve(filename);
    let current = path.parse(target).root;
    const parts = target.slice(current.length).split(path.sep).filter(Boolean);
    let last: any;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        last = await fs.lstat(current, { bigint: true });
      } catch (e) {
        if (e.code === 'ENOENT') return { filename: target, inode: null };
        throw e;
      }
      if (last.isSymbolicLink()) {
        if (
          !(
            i < parts.length - 1 &&
            process.platform === 'darwin' &&
            ['/var', '/tmp', '/etc'].includes(current) &&
            (await fs.realpath(current)) === '/private' + current
          )
        )
          throw new Error();
      } else if (i < parts.length - 1 ? !last.isDirectory() : !last.isFile()) throw new Error();
    }
    return { filename: target, inode: inode(last) };
  }
  const anchor = path.join(root(), duck ? path.join(duck[1], 'data.duckdb') : sqlite[1]);
  const canonical = await resolveDeletionFilename(root(), anchor, kind);
  const actual = path.join(canonical.root, relative);
  let current = canonical.root,
    last: any;
  const parts = relative.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      last = await fs.lstat(current, { bigint: true });
    } catch (error) {
      if (error.code === 'ENOENT') return { filename: actual, inode: null };
      throw error;
    }
    if (last.isSymbolicLink() || (i < parts.length - 1 ? !last.isDirectory() : !last.isFile()))
      throw new Error();
  }
  return { filename: actual, inode: inode(last) };
}
async function consumers(
  sourceId: number,
  files: Capture[],
  metadata: Awaited<ReturnType<typeof custodyMetadata>>,
) {
  const observedHardlink = files.some(file => file.hardlink);
  if (metadata.limited) return observedHardlink ? ('present' as const) : ('unresolved' as const);
  let present = observedHardlink,
    invalid = false;
  const targets = new Set(files.flatMap(file => file.inodes));
  const compare = async (filename: string) => {
    try {
      const candidate = await consumerPath(filename, metadata.trustedMetadataFile);
      if (candidate.inode && targets.has(candidate.inode)) present = true;
      for (const file of files) {
        if (file.kind === 'sqlite') {
          if (
            ['', '-wal', '-shm', '-journal'].some(
              suffix => candidate.filename === file.filename + suffix,
            )
          )
            present = true;
        } else {
          const relative = path.relative(path.dirname(file.filename), candidate.filename);
          if (
            relative !== '..' &&
            !relative.startsWith('..' + path.sep) &&
            !path.isAbsolute(relative)
          )
            present = true;
        }
      }
    } catch {
      invalid = true;
    }
  };
  for (const source of metadata.databases) {
    if (source.id === sourceId || !fileEngines.includes(String(source.engine).trim().toLowerCase()))
      continue;
    try {
      for (const filename of filenames(parseConnectionConfig(source.connectionConfig)))
        await compare(filename);
    } catch {
      invalid = true;
    }
  }
  for (const source of metadata.commerce)
    if (source.publishedFilename !== null) await compare(source.publishedFilename);
  return present
    ? ('present' as const)
    : invalid
    ? ('unresolved' as const)
    : ('none_observed' as const);
}

export async function inspectHandoverCustody(
  source: Database,
  metadata: Awaited<ReturnType<typeof custodyMetadata>>,
  refresh: Awaited<ReturnType<typeof custodyRefresh>>,
  internalProof = false,
) {
  const unresolved = {
    storage: 'unresolved',
    identity: 'unresolved',
    filesChecked: 0,
    consumers: 'unresolved',
    refresh: 'active_or_unresolved',
  } as const;
  const engine = String(source.engine).trim().toLowerCase();
  if (handoverStorage(engine) === 'unresolved') return unresolved;
  let config: any;
  try {
    config = parseConnectionConfig(source.connectionConfig);
    if (!object(config)) throw new Error();
  } catch {
    return unresolved;
  }
  if (!fileEngines.includes(engine))
    return {
      storage: 'external_connection',
      identity: 'not_applicable',
      filesChecked: 0,
      consumers: 'not_applicable',
      refresh: 'not_applicable',
    } as const;
  let paths: string[];
  try {
    paths = filenames(config);
  } catch {
    return unresolved;
  }
  const kind = engine === 'duckdb' ? 'duckdb' : 'sqlite';
  const files: Capture[] = [];
  let valid = true;
  for (const filename of paths) {
    try {
      files.push(await capture(filename, kind, source.id));
    } catch {
      valid = false;
    }
  }
  let shared: 'unresolved' | 'present' | 'none_observed' = valid
    ? await consumers(source.id, files, metadata)
    : 'unresolved';
  for (const file of files) {
    try {
      if ((await capture(file.requestedFilename, kind, source.id)).signature !== file.signature)
        valid = false;
    } catch {
      valid = false;
    }
  }
  if (!valid) shared = 'unresolved';
  return {
    storage: 'managed_file',
    identity: valid ? 'observed' : 'unresolved',
    filesChecked: files.length,
    consumers: shared,
    refresh,
    ...(internalProof ? { custodySignature: digest(files.map(file => file.signature)) } : {}),
  };
}
