import { DataSource } from 'typeorm';

export async function assertMetadataDatabaseVersion(db: DataSource): Promise<void> {
  if (db.options.type === 'sqlite') return;
  if (db.options.type !== 'postgres')
    throw new Error(`Unsupported metadata database: ${db.options.type}`);
  const [{ version }] = await db.query(
    "SELECT current_setting('server_version_num')::int AS version",
  );
  if (Number(version) < 170000)
    throw new Error(`PostgreSQL 17 or newer is required; connected to server version ${version}`);
}
