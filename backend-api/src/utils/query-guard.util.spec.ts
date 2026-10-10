import { HttpException } from '@nestjs/common';
import { assertReadOnlyQuery, assertSafeIdentifier } from './query-guard.util';

describe('query-guard.util', () => {
  describe('assertReadOnlyQuery', () => {
    it.each([
      'SELECT * FROM users',
      '  select id, name from orders where created_at > now()  ',
      'WITH t AS (SELECT 1) SELECT * FROM t',
      'show tables',
      'EXPLAIN SELECT 1',
      'SELECT * FROM users;',
    ])('읽기 쿼리 허용: %s', q => {
      expect(() => assertReadOnlyQuery(q)).not.toThrow();
    });

    it.each([
      'DROP TABLE users',
      'DELETE FROM users WHERE id = 1',
      'SELECT * FROM users; DROP TABLE users',
      'INSERT INTO logs VALUES (1)',
      "UPDATE users SET name = 'x'",
      'CREATE TABLE t (id int)',
      'SELECT * INTO backup FROM users',
    ])('쓰기/다중 쿼리 차단: %s', q => {
      expect(() => assertReadOnlyQuery(q)).toThrow(HttpException);
    });

    it('QUERY_ALLOW_WRITE=true 이면 쓰기 쿼리도 허용한다', () => {
      process.env.QUERY_ALLOW_WRITE = 'true';
      try {
        expect(() => assertReadOnlyQuery('DELETE FROM users')).not.toThrow();
      } finally {
        delete process.env.QUERY_ALLOW_WRITE;
      }
    });
  });

  describe('assertSafeIdentifier', () => {
    it.each(['users', 'order_items', 'schema.table', 'my-db', '$temp'])(
      '유효한 식별자: %s',
      name => {
        expect(() => assertSafeIdentifier(name)).not.toThrow();
      },
    );

    it.each(['users; DROP TABLE x', 'a" OR 1=1 --', "name' /*", 'a b', 'a`b', ''])(
      '위험한 식별자 차단: %s',
      name => {
        expect(() => assertSafeIdentifier(name)).toThrow(HttpException);
      },
    );
  });
});
