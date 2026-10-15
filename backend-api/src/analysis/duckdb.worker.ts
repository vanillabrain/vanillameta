import { parentPort } from 'worker_threads';
import { DuckDBInstance, DuckDBConnection, DuckDBTimestampTZValue } from '@duckdb/node-api';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importCommerce } from './commerce-import';

// The adapter defaults to the host offset independently of the connection's UTC setting.
DuckDBTimestampTZValue.timezoneOffsetInMinutes = 0;

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const identifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const normalize = (value: any): any => {
  if (typeof value === 'bigint') {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  }
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (/^DuckDB(Decimal|Date|Time|Timestamp|Interval).*Value$/.test(value.constructor?.name || ''))
    return value.toString();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
};

let runningConnection: DuckDBConnection;
parentPort.on('message', async task => {
  if (task.kind === 'cancel') {
    runningConnection?.interrupt();
    return;
  }
  let instance: DuckDBInstance;
  let connection: DuckDBConnection;
  try {
    if (task.kind === 'remove') {
      await fs.rm(path.dirname(task.filename), { recursive: true, force: true });
      parentPort.postMessage({ id: task.id, result: {} });
      return;
    }
    instance = await DuckDBInstance.create(task.filename, {
      access_mode: ['import', 'commerce-import'].includes(task.kind) ? 'READ_WRITE' : 'READ_ONLY',
      memory_limit: task.memoryLimit,
      threads: String(task.threads),
      temp_directory: task.tempDirectory,
      max_temp_directory_size: task.tempLimit,
      enable_external_access: ['import', 'commerce-import'].includes(task.kind) ? 'true' : 'false',
      autoinstall_known_extensions: 'false',
      autoload_known_extensions: 'false',
      allow_unsigned_extensions: 'false',
    });
    connection = await instance.connect();
    await connection.run("SET TimeZone = 'UTC'");
    runningConnection = connection;
    let result: any;
    if (task.kind === 'commerce-import') {
      result = await importCommerce(connection, {
        files: {
          orders: task.sourcePaths[0],
          payments: task.sourcePaths[1],
          refunds: task.sourcePaths[2],
          ...(task.sourcePaths[3] ? { customers: task.sourcePaths[3] } : {}),
        },
        sampleType: task.sampleType,
      });
      if (task.analytical && result.valid) {
        // One row per order: independently aggregate events before joining, avoiding payment/refund fanout.
        // Time grouping is explicitly an order-date cohort, not payment/refund cash-flow event time.
        await connection.run(`CREATE TABLE uploaded_data AS
          WITH payments AS (
            SELECT order_id, SUM(amount) AS revenue FROM commerce_payments
            WHERE payment_status='succeeded' GROUP BY order_id
          ), refunds AS (
            SELECT order_id, SUM(amount) AS refund_amount, COUNT(*) AS refund_count
            FROM commerce_refunds GROUP BY order_id
          )
          SELECT o.ordered_at, o.channel, o.currency,
            CAST(COALESCE(p.revenue,0) AS DECIMAL(18,2)) AS revenue,
            CAST(COALESCE(r.refund_amount,0) AS DECIMAL(18,2)) AS refund_amount,
            CAST(COALESCE(p.revenue,0)-COALESCE(r.refund_amount,0) AS DECIMAL(18,2)) AS net_amount,
            CASE WHEN p.order_id IS NOT NULL THEN 1 ELSE 0 END AS paid_orders,
            CASE WHEN r.order_id IS NOT NULL THEN 1 ELSE 0 END AS refunded_orders
          FROM commerce_orders o LEFT JOIN payments p USING(order_id)
          LEFT JOIN refunds r USING(order_id)`);
      }
      await connection.run('CHECKPOINT');
    } else if (task.kind === 'import') {
      const source = literal(task.sourcePath);
      const reader =
        task.extension === '.parquet'
          ? `read_parquet(${source})`
          : task.extension === '.json'
          ? `read_json_auto(${source}, format='array', maximum_object_size=16777216)`
          : `read_csv(${source}, header=true, sample_size=-1, strict_mode=true)`;
      if (task.extension === '.json') {
        const invalid = await connection.runAndReadAll(
          `SELECT count(*) AS n FROM read_json_objects(${source}, format='array') WHERE json_type(json) <> 'OBJECT'`,
        );
        if (Number(invalid.getRowObjects()[0].n))
          throw new Error('json file must contain an array of objects');
      }
      await connection.run(`CREATE VIEW imported AS SELECT * FROM ${reader}`);
      const schema = await connection.runAndReadAll('DESCRIBE imported');
      const seen = new Set<string>();
      const projection = schema.getRowObjects().map((column: any, index) => {
        const name = String(column.column_name);
        let safe = name.trim().replace(/[^A-Za-z0-9_]/g, '_') || `col_${index + 1}`;
        if (/^[0-9]/.test(safe)) safe = `_${safe}`;
        while (seen.has(safe.toLowerCase())) safe += '_';
        seen.add(safe.toLowerCase());
        const type = String(column.column_type);
        const expression = /STRUCT|MAP|\[/.test(type)
          ? `to_json(${identifier(name)})`
          : identifier(name);
        return `${expression} AS ${identifier(safe)}`;
      });
      await connection.run(
        `CREATE TABLE uploaded_data AS SELECT ${projection.join(', ')} FROM imported`,
      );
      await connection.run('DROP VIEW imported');
      const count = await connection.runAndReadAll('SELECT count(*) AS rows FROM uploaded_data');
      const rows = Number(count.getRowObjects()[0].rows);
      if (!rows) throw new Error('no rows found in the uploaded file');
      await connection.run('CHECKPOINT');
      result = { rows };
    } else {
      // Stream only a bounded result; do not materialize SELECT * into the API's heap.
      const reader = await connection.streamAndReadUntil(task.sql, task.maxRows + 1, task.bindings);
      if (reader.currentRowCount > task.maxRows || !reader.done) {
        throw new Error(
          `query result exceeds ${task.maxRows} rows; add LIMIT or aggregate the data`,
        );
      }
      let bytes = 0;
      const maxBytes = task.maxResultBytes;
      // Validate variable-width cells before building row objects and cloning across threads.
      for (let row = 0; row < reader.currentRowCount; row++) {
        for (let column = 0; column < reader.columnCount; column++) {
          const value = reader.value(column, row);
          const size = typeof value === 'string' ? Buffer.byteLength(value) : 32;
          bytes += size;
          if (size > 1024 * 1024 || bytes > maxBytes)
            throw new Error('query result too large; aggregate or select fewer columns');
        }
      }
      const datas = reader.getRowObjects().map(normalize);
      if (Buffer.byteLength(JSON.stringify(datas)) > maxBytes)
        throw new Error('query result too large');
      const fields = reader.columnNames().map((name, index) => {
        const type = reader.columnType(index).toString();
        return {
          columnName: name,
          columnType:
            /^(U?TINYINT|U?SMALLINT|U?INTEGER|U?BIGINT|U?HUGEINT|FLOAT|DOUBLE|DECIMAL)/.test(type)
              ? 'number'
              : /^(DATE|TIME|TIMESTAMP)/.test(type)
              ? 'date'
              : 'string',
        };
      });
      result = { datas, fields };
    }
    runningConnection = undefined;
    connection.closeSync();
    connection = undefined;
    instance.closeSync();
    instance = undefined;
    parentPort.postMessage({ id: task.id, result });
  } catch (error) {
    runningConnection = undefined;
    connection?.closeSync();
    instance?.closeSync();
    const message = /Expected top-level JSON array/.test(error.message)
      ? 'json file must contain an array of objects'
      : error.message
          .replaceAll(task.sourcePath || '\0', '<uploaded file>')
          .replaceAll(task.sourcePaths?.[0] || '\0', '<orders CSV>')
          .replaceAll(task.sourcePaths?.[1] || '\0', '<payments CSV>')
          .replaceAll(task.sourcePaths?.[2] || '\0', '<refunds CSV>');
    parentPort.postMessage({ id: task.id, error: message });
  }
});
