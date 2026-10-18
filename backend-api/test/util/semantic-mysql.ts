import * as fs from 'fs';
import { DataSource, DataSourceOptions } from 'typeorm';

/** Test-only opt-in. Validate fixture ownership before TypeORM may create any tables. */
export async function semanticMetadata(
  lane: 'studio' | 'runtime' | 'staff' | 'departure' | 'handover',
  sqlite: DataSourceOptions,
): Promise<DataSource> {
  const file = process.env.VM_SEMANTIC_MYSQL_CONFIG;
  if (!file) return new DataSource(sqlite).initialize();
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0)
    throw new Error('Private regular MySQL config required');
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    c.gate !== 'owned-semantic-mysql-v1' ||
    !/^[a-f0-9]{24}$/.test(c.owner) ||
    c.owner !== process.env.VM_SEMANTIC_MYSQL_OWNER ||
    c.host !== '127.0.0.1' ||
    !Number.isInteger(c.port) ||
    c.port < 1024 ||
    c.port > 65535 ||
    c.username !== 'root' ||
    typeof c.password !== 'string' ||
    !c.password ||
    c.databasePrefix !== 'vm_semantic_' + c.owner ||
    typeof c.serverUuid !== 'string' ||
    !c.serverUuid
  )
    throw new Error('Refusing non-owned semantic MySQL fixture');
  const db = await new DataSource({
    type: 'mysql',
    host: c.host,
    port: c.port,
    username: c.username,
    password: c.password,
    database: c.databasePrefix + '_' + lane,
    entities: sqlite.entities,
    timezone: 'Z',
    logging: false,
    extra: { connectionLimit: 6, connectTimeout: 5000 },
  }).initialize();
  try {
    await assertSemanticMysqlIdentity(db);
    await db.synchronize();
    return db;
  } catch (error) {
    await db.destroy();
    throw error;
  }
}

export async function assertSemanticMysqlIdentity(db: DataSource) {
  if (db.options.type !== 'mysql') return;
  const c = JSON.parse(fs.readFileSync(process.env.VM_SEMANTIC_MYSQL_CONFIG, 'utf8'));
  const [server] = await db.query(
    'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
  );
  if (
    !/^8\.4\./.test(server.version) ||
    server.uuid !== c.serverUuid ||
    !['studio', 'runtime', 'staff', 'departure', 'handover'].some(
      lane => server.db === c.databasePrefix + '_' + lane,
    )
  )
    throw new Error('Unexpected semantic MySQL identity');
  const [marker] = await db.query('SELECT token FROM semantic_fixture_owner');
  if (marker?.token !== c.owner) throw new Error('Unowned semantic MySQL database');
}
