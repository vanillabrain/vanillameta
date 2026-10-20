import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

// Independent reference SQL: intentionally does not import product query builders.
const require = createRequire(new URL('../../backend-api/package.json', import.meta.url));
const { DuckDBInstance } = require('@duckdb/node-api');
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const filename = process.argv[2] || manifest.localVerificationFile;
const bytes = await readFile(filename);
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256, 'sample checksum changed');
const instance = await DuckDBInstance.create(':memory:');
const connection = await instance.connect();
try {
  // Queries below read the original file; avoid loading the full sample into JS.
  const escaped = filename.replace(/'/g, "''");
  const source = `read_parquet('${escaped}')`;
  const results = {};
  for (const [name, condition] of [
    ['all', ''],
    ['mobile', "WHERE device_type = 'Mobile/Tablet'"],
    ['dated', "WHERE __time >= TIMESTAMP '2023-09-10' AND __time < TIMESTAMP '2023-09-12' AND device_type IN ('Mobile/Tablet', 'Personal Computer')"],
  ]) {
    const total = (await connection.runAndReadAll(`SELECT CAST(COUNT(*) AS VARCHAR) AS row_count,
      CAST(SUM(bid_request_cnt) AS VARCHAR) AS requests,
      SUM(bid_floor)/SUM(has_bid_floor_cnt) AS avg_bid_floor FROM ${source} ${condition}`)).getRowObjectsJson()[0];
    const groups = (await connection.runAndReadAll(`SELECT device_type AS category,
      CAST(SUM(bid_request_cnt) AS VARCHAR) AS value FROM ${source} ${condition}
      GROUP BY device_type ORDER BY SUM(bid_request_cnt) DESC, device_type`)).getRowObjectsJson();
    results[name] = { total, groups };
  }
  results.previous = (await connection.runAndReadAll(`SELECT CAST(SUM(bid_request_cnt) AS VARCHAR) AS requests,
    SUM(bid_floor)/SUM(has_bid_floor_cnt) AS avg_bid_floor FROM ${source}
    WHERE __time >= TIMESTAMP '2023-09-08' AND __time < TIMESTAMP '2023-09-10'
      AND device_type IN ('Mobile/Tablet', 'Personal Computer')`)).getRowObjectsJson()[0];
  assert.equal(results.previous.requests, '70612400');
  assert.equal(results.all.total.row_count, String(manifest.oracle.rows));
  assert.equal(results.all.total.requests, String(manifest.oracle.requests));
  assert.ok(Math.abs(results.all.total.avg_bid_floor - manifest.oracle.avgBidFloor) <= manifest.oracle.avgBidFloorTolerance);
  assert.equal(results.mobile.total.requests, '307763000');
  assert.equal(results.dated.total.requests, '138055400');
  console.log(JSON.stringify(results, null, 2));
} finally {
  connection.closeSync();
  instance.closeSync();
}
