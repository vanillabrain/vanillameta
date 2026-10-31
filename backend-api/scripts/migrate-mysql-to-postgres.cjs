#!/usr/bin/env node
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const backend = path.resolve(__dirname, '..');
const requireBackend = createRequire(path.join(backend, 'package.json'));
const mysql = requireBackend('mysql2/promise');
const { Client, types } = requireBackend('pg');

const apply = process.argv.includes('--apply');
const receiptIndex = process.argv.indexOf('--receipt');
const receiptPath =
  receiptIndex >= 0 && process.argv[receiptIndex + 1]
    ? path.resolve(process.argv[receiptIndex + 1])
    : null;

const source = {
  host: process.env.SOURCE_MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.SOURCE_MYSQL_PORT || 3306),
  user: process.env.SOURCE_MYSQL_USER,
  password: process.env.SOURCE_MYSQL_PASSWORD,
  database: process.env.SOURCE_MYSQL_DATABASE,
};

function requiredTarget() {
  const names = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_NAME'];
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing PostgreSQL target settings: ${missing.join(', ')}`);
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  };
}

const quoteMysql = value => `\`${String(value).replace(/`/g, '``')}\``;
const quotePg = value => `"${String(value).replace(/"/g, '""')}"`;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stable(value[key])]),
    );
  }
  return value;
}

function canonical(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === 'boolean') return value === true || value === 1 || value === '1';
  if (dataType.includes('timestamp') || dataType === 'date') {
    if (value instanceof Date) return value.toISOString();
    return String(value).trim().replace(' ', 'T');
  }
  if (['json', 'jsonb'].includes(dataType)) {
    return typeof value === 'string' ? stable(JSON.parse(value)) : stable(value);
  }
  if (dataType === 'bytea') return Buffer.from(value).toString('hex');
  if (['bigint', 'numeric', 'decimal', 'money'].includes(dataType)) return String(value);
  if (Buffer.isBuffer(value)) return value.toString('hex');
  return value;
}

function rowHash(columns, rows) {
  const hash = createHash('sha256');
  const canonicalRows = rows
    .map(row =>
      JSON.stringify(columns.map(column => canonical(row[column.column_name], column.data_type))),
    )
    .sort();
  for (const row of canonicalRows) {
    hash.update(row);
    hash.update('\n');
  }
  return hash.digest('hex');
}

function dependencyOrder(tables, edges) {
  const remaining = new Set(tables);
  const order = [];
  while (remaining.size) {
    const ready = [...remaining]
      .filter(table => !edges.some(edge => edge.child === table && remaining.has(edge.parent)))
      .sort();
    if (!ready.length)
      throw new Error(
        `Foreign-key cycle requires a reviewed transfer order: ${[...remaining].join(', ')}`,
      );
    for (const table of ready) {
      remaining.delete(table);
      order.push(table);
    }
  }
  return order;
}

async function main() {
  if (!source.user || !source.database)
    throw new Error('SOURCE_MYSQL_USER and SOURCE_MYSQL_DATABASE are required');
  const targetConfig = requiredTarget();
  process.env.NODE_ENV = 'prod';
  process.env.DB_HOST = targetConfig.host;
  process.env.DB_PORT = String(targetConfig.port);
  process.env.DB_USERNAME = targetConfig.user;
  process.env.DB_PASSWORD = targetConfig.password;
  process.env.DB_NAME = targetConfig.database;

  const mysqlClient = await mysql.createConnection({
    ...source,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
  });
  const pg = new Client({
    ...targetConfig,
    types: {
      getTypeParser: (oid, format) =>
        [1082, 1114, 1184].includes(oid) ? value => value : types.getTypeParser(oid, format),
    },
  });
  await pg.connect();
  const { default: target } = require(path.join(backend, 'dist/src/data-source.js'));
  await target.initialize();

  const existing = (
    await pg.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'",
    )
  ).rows.map(row => row.table_name);
  if (apply && existing.length)
    throw new Error(
      'PostgreSQL target has tables; use a new empty target database for an atomic cutover',
    );

  const sourceTables = (
    await mysqlClient.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE'",
      [source.database],
    )
  )[0].map(row => String(row.table_name ?? row.TABLE_NAME));
  const sourceByName = new Map(
    sourceTables.map(table => [table.toLowerCase(), table]),
  );
  if (!apply) {
    const counts = [];
    for (const table of [...sourceTables].sort((a, b) => a.localeCompare(b))) {
      const [[row]] = await mysqlClient.query(
        `SELECT COUNT(*) AS count FROM ${quoteMysql(table)}`,
      );
      counts.push({ table, rows: Number(row.count) });
    }
    const result = {
      verdict: 'DRY_RUN',
      source: source.database,
      target: targetConfig.database,
      sourceTables: counts.length,
      counts,
      writes: 0,
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  await target.synchronize();
  const tables = (
    await pg.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY table_name",
    )
  ).rows.map(row => row.table_name);
  const transferable = tables.filter(
    table => table !== 'migrations' && sourceByName.has(table.toLowerCase()),
  );
  const edges = (
    await pg.query(`
      SELECT child.relname AS child, parent.relname AS parent
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
      WHERE c.contype = 'f' AND n.nspname = current_schema()
    `)
  ).rows;
  const order = dependencyOrder(transferable, edges);
  const columns = (
    await pg.query(`
      SELECT table_name, column_name, data_type, ordinal_position,
             is_generated, is_identity
      FROM information_schema.columns
      WHERE table_schema=current_schema()
      ORDER BY table_name, ordinal_position
    `)
  ).rows;
  const primaryKeys = (
    await pg.query(`
      SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema=current_schema() AND tc.constraint_type='PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position
    `)
  ).rows;
  const result = {
    verdict: 'VERIFIED',
    source: source.database,
    target: targetConfig.database,
    tables: [],
  };
  await pg.query('BEGIN');
  try {
    for (const table of order) {
      const tableColumns = columns
        .filter(column => column.table_name === table && column.is_generated !== 'ALWAYS')
        .map(column => column.column_name);
      const sourceName = sourceByName.get(table.toLowerCase());
      const sourceColumns = new Set(
        (
          await mysqlClient.query(
            'SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name=?',
            [source.database, sourceName],
          )
        )[0].map(column => String(column.column_name || column.COLUMN_NAME).toLowerCase()),
      );
      const copiedColumns = tableColumns.filter(column => sourceColumns.has(column.toLowerCase()));
      if (!copiedColumns.length) throw new Error(`No matching columns for ${table}`);
      const pk = primaryKeys.filter(row => row.table_name === table).map(row => row.column_name);
      const orderBy = pk.length ? ` ORDER BY ${pk.map(quoteMysql).join(', ')}` : '';
      const [sourceRows] = await mysqlClient.query(
        `SELECT ${copiedColumns.map(quoteMysql).join(', ')} FROM ${quoteMysql(
          sourceName,
        )}${orderBy}`,
      );
      const normalizedSourceRows = sourceRows.map(row =>
        Object.fromEntries(
          copiedColumns.map(column => [column, row[column] ?? row[column.toUpperCase()]]),
        ),
      );
      const dataTypes = Object.fromEntries(
        columns
          .filter(column => column.table_name === table)
          .map(column => [column.column_name, column.data_type]),
      );
      let inserted = 0;
      for (let start = 0; start < normalizedSourceRows.length; start += 500) {
        const batch = normalizedSourceRows.slice(start, start + 500);
        const values = [];
        const placeholders = batch.map((row, rowIndex) => {
          const slots = copiedColumns.map((column, columnIndex) => {
            const value = canonical(row[column], dataTypes[column]);
            values.push(value);
            return `$${rowIndex * copiedColumns.length + columnIndex + 1}`;
          });
          return `(${slots.join(',')})`;
        });
        await pg.query(
          `INSERT INTO ${quotePg(table)} (${copiedColumns
            .map(quotePg)
            .join(',')}) VALUES ${placeholders.join(',')}`,
          values,
        );
        inserted += batch.length;
      }
      const targetResult = await pg.query(
        `SELECT ${copiedColumns.map(quotePg).join(',')} FROM ${quotePg(table)}${
          pk.length ? ` ORDER BY ${pk.map(quotePg).join(',')}` : ''
        }`,
      );
      const targetColumns = copiedColumns.map(column => ({
        column_name: column,
        data_type: dataTypes[column],
      }));
      const sourceHash = rowHash(targetColumns, normalizedSourceRows);
      const targetHash = rowHash(targetColumns, targetResult.rows);
      if (inserted !== targetResult.rowCount || sourceHash !== targetHash)
        throw new Error(`Row verification failed for ${table}`);
      result.tables.push({ table, rows: inserted, sha256: targetHash });
    }
    await pg.query('COMMIT');
  } catch (error) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw error;
  }

  for (const table of order) {
    const pk = primaryKeys.find(row => row.table_name === table);
    if (!pk) continue;
    const sequence = await pg.query('SELECT pg_get_serial_sequence($1, $2) AS name', [
      quotePg(table),
      pk.column_name,
    ]);
    const name = sequence.rows[0]?.name;
    if (name)
      await pg.query(
        `SELECT setval($1::regclass, COALESCE((SELECT MAX(${quotePg(
          pk.column_name,
        )}) FROM ${quotePg(table)}),0)+1, false)`,
        [name],
      );
  }
  await target.runMigrations({ fake: true, transaction: 'all' });
  result.migrations = await pg.query('SELECT name FROM migrations ORDER BY id');
  result.migrations = result.migrations.rows;
  result.verdict = 'VERIFIED';
  process.stdout.write(JSON.stringify(result) + '\n');
  if (receiptPath) {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(receiptPath, JSON.stringify({ id: randomUUID(), ...result }, null, 2), {
      mode: 0o600,
    });
  }
  await target.destroy();
  await pg.end();
  await mysqlClient.end();
}

main().catch(error => {
  process.stderr.write(JSON.stringify({ verdict: 'FAILED', message: error.message }) + '\n');
  process.exitCode = 1;
});
