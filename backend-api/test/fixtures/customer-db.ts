import { join } from 'path';

const sqlite3 = require('sqlite3');

export const CUSTOMER_DB_PATH = join(__dirname, 'customer.sqlite');

/**
 * "고객 데이터소스" 역할을 하는 로컬 SQLite 파일을 결정적으로 재생성한다.
 * 외부 DB 없이 BI 의 쿼리 실행 경로(ConnectionService → Knex → executeQuery)를 검증하기 위함.
 */
export function createCustomerDb(file: string = CUSTOMER_DB_PATH): Promise<string> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (openErr: Error | null) => {
      if (openErr) return reject(openErr);

      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS sample_table1');
        db.run(
          'CREATE TABLE sample_table1 (id INTEGER PRIMARY KEY, name TEXT, amount INTEGER, created_at TEXT)',
        );
        db.run(
          "INSERT INTO sample_table1 (name, amount, created_at) VALUES ('alpha', 10, '2024-01-01'), ('beta', 20, '2024-01-02'), ('gamma', 30, '2024-01-03')",
        );
      });

      db.close((closeErr: Error | null) => {
        if (closeErr) return reject(closeErr);
        resolve(file);
      });
    });
  });
}
