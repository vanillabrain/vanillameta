// Offline, read-only inventory. Never assigns the first reader or inferred dashboard user.
const sqlite = require('sqlite3');
const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/source-ownership-audit.cjs /absolute/metadata.db');
const db = new sqlite.Database(filename, sqlite.OPEN_READONLY, error => {
  if (error) throw error;
  db.all(`SELECT d.id, d.ownerId,
    (SELECT COUNT(*) FROM dataset ds WHERE ds.databaseId=d.id) AS datasets,
    (SELECT COUNT(*) FROM metric m WHERE m.databaseId=d.id) AS metrics,
    (SELECT COUNT(*) FROM table_query tq WHERE tq.databaseId=d.id) AS tableQueries
    FROM "database" d ORDER BY d.id`, [], (error, rows) => {
    db.close();
    if (error) throw error;
    console.log(JSON.stringify({ mode: 'read-only', sources: rows, lockedLegacy: rows.filter(row => row.ownerId === null).map(row => row.id) }, null, 2));
  });
});
