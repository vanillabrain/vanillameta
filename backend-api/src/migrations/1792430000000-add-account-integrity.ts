import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export const USER_ID_UNIQUE = 'UQ_user_userId';
export const USER_EMAIL_UNIQUE = 'UQ_user_email';
export const MEMBERSHIP_USER_FK = 'FK_enterprise_membership_user';

const REQUIRED_USER_COLUMNS = ['id', 'userId', 'email'];
const USER_UNIQUE_INDEXES: ReadonlyArray<readonly [string, readonly string[]]> = [
  [USER_ID_UNIQUE, ['userId']],
  [USER_EMAIL_UNIQUE, ['email']],
];
const MEMBERSHIP_USER_COLUMNS: readonly string[] = ['userId'];
const USER_ID_COLUMNS: readonly string[] = ['id'];

const ENGINE_CHECKED_TYPES = ['mysql', 'mariadb'];

/**
 * MySQL/MariaDB can silently ignore a foreign key on a non-InnoDB table, so both the parent and
 * the child engine must be known InnoDB before the constraint is trusted. An engine that cannot be
 * read is reported as unknown instead of being treated as safe. SQLite has no table engine.
 */
export const engineProblem = (
  driverType: string,
  engine: unknown,
  readable: boolean,
): 'engineUnknown' | 'unsupportedEngine' | undefined => {
  if (!ENGINE_CHECKED_TYPES.includes(driverType)) return undefined;
  if (!readable || typeof engine !== 'string' || engine.trim().length === 0) return 'engineUnknown';
  return engine.trim().toLowerCase() === 'innodb' ? undefined : 'unsupportedEngine';
};

const sameColumns = (left: readonly string[] | undefined, right: readonly string[]): boolean =>
  (left ?? []).length === right.length &&
  (left ?? []).every((name, index) => name === right[index]);

/**
 * The ownership key must be the single primary column. A composite primary key would leave the
 * referenced id non-unique (so SQLite could not enforce the foreign key) or would let one account
 * hold several organization rows, so it fails closed instead of passing on a column flag alone.
 */
const isCanonicalKey = (
  primaryColumns: ReadonlyArray<{ name?: string }> | undefined,
  name: string,
): boolean => (primaryColumns ?? []).length === 1 && primaryColumns?.[0]?.name === name;

/**
 * UC-051 FR016/FR017 account identity integrity: named unique user indexes plus a RESTRICT
 * ownership foreign key from enterprise_membership.userId to user.id.
 *
 * The migration is additive and idempotent. Every duplicate/NULL/orphan, every referenced-column
 * and primary-key shape, and every already-present same-named index/foreign key definition is
 * checked before any DDL runs. Diagnostics report kind/count only (never an identifier), and no
 * existing user, membership, index, or foreign key is deleted, merged, rewritten, or repaired.
 * A fresh database without a user table is left to the synchronize baseline, while a partially
 * created table fails closed instead of pretending to be repaired.
 *
 * MySQL DDL is not transactional and can implicitly commit, so production requires a maintenance
 * window: stop writers, take a reviewed backup, and confirm both tables are InnoDB. This change is
 * validated only against isolated fixtures; applying it to production is a separate reviewed step.
 */
export class AddAccountIntegrity1792430000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('user'))) return;

    const missing: string[] = [];
    for (const column of REQUIRED_USER_COLUMNS)
      if (!(await runner.hasColumn('user', column))) missing.push(column);
    if (missing.length)
      throw new Error(
        `Account integrity preflight stopped: the user table is missing the ${missing.join(
          ', ',
        )} column(s).`,
      );

    const escape = (name: string) => runner.connection.driver.escape(name);
    const user = escape('user');
    const membership = escape('enterprise_membership');
    const value = escape('value');
    const count = async (sql: string) => {
      const [row] = await runner.query(sql);
      return Number(row?.['value'] ?? 0);
    };
    const duplicates = (column: string) =>
      count(
        `SELECT COUNT(*) AS ${value} FROM (SELECT ${escape(column)} FROM ${user} WHERE ${escape(
          column,
        )} IS NOT NULL GROUP BY ${escape(column)} HAVING COUNT(*) > 1) AS ${escape('duplicates')}`,
      );
    const nulls = (column: string) =>
      count(`SELECT COUNT(*) AS ${value} FROM ${user} WHERE ${escape(column)} IS NULL`);

    const diagnostics = new Map<string, number>();
    const flag = (kind: string, total = 1) =>
      diagnostics.set(kind, (diagnostics.get(kind) ?? 0) + total);

    diagnostics.set('duplicateUserId', await duplicates('userId'));
    diagnostics.set('duplicateEmail', await duplicates('email'));
    diagnostics.set('nullUserId', await nulls('userId'));
    diagnostics.set('nullEmail', await nulls('email'));

    const userTable = await runner.getTable('user');
    const idColumn = userTable?.findColumnByName('id');
    if (!isCanonicalKey(userTable?.primaryColumns, 'id')) flag('referencedIdNotCanonicalKey');

    for (const [name, columns] of USER_UNIQUE_INDEXES) {
      const existing = userTable?.indices.find(index => index.name === name);
      if (existing && !(existing.isUnique && sameColumns(existing.columnNames, columns)))
        flag('indexDefinitionDrift');
    }

    const hasMembership = await runner.hasTable('enterprise_membership');
    let membershipTable: Table | undefined;
    let membershipUserIdColumn: ReturnType<Table['findColumnByName']>;
    if (hasMembership && !(await runner.hasColumn('enterprise_membership', 'userId')))
      flag('membershipUserColumnMissing');
    else if (hasMembership) {
      membershipTable = await runner.getTable('enterprise_membership');
      membershipUserIdColumn = membershipTable?.findColumnByName('userId');
      if (!isCanonicalKey(membershipTable?.primaryColumns, 'userId'))
        flag('membershipKeyNotCanonicalKey');
      if (
        membershipUserIdColumn &&
        idColumn &&
        (String(membershipUserIdColumn.type).toLowerCase() !==
          String(idColumn.type).toLowerCase() ||
          Boolean(membershipUserIdColumn.unsigned) !== Boolean(idColumn.unsigned))
      )
        flag('idTypeMismatch');
      for (const [tableName, table] of [
        ['user', userTable],
        ['enterprise_membership', membershipTable],
      ] as const) {
        const engine = await this.tableEngine(runner, tableName, table);
        const problem = engineProblem(runner.connection.options.type, engine, engine !== undefined);
        if (problem) flag(problem);
      }
      diagnostics.set(
        'orphanMembership',
        await count(
          `SELECT COUNT(*) AS ${value} FROM ${membership} AS ${escape(
            'm',
          )} WHERE NOT EXISTS (SELECT 1 FROM ${user} AS ${escape('u')} WHERE ${escape(
            'u',
          )}.${escape('id')} = ${escape('m')}.${escape('userId')})`,
        ),
      );

      const named = membershipTable?.foreignKeys.find(fk => fk.name === MEMBERSHIP_USER_FK);
      if (named && !this.linksMembershipToUser(named)) flag('foreignKeyDefinitionDrift');
    }

    const problems = [...diagnostics].filter(([, total]) => total > 0);
    if (problems.length)
      throw new Error(
        `Account integrity preflight stopped before DDL: ${problems
          .map(([kind, total]) => `${kind}=${total}`)
          .join(', ')}.`,
      );

    for (const [name, columns] of USER_UNIQUE_INDEXES) {
      const table = await runner.getTable('user');
      if (table?.indices.some(index => index.name === name)) continue;
      await runner.createIndex(
        'user',
        new TableIndex({ name, columnNames: [...columns], isUnique: true }),
      );
    }

    if (hasMembership && membershipUserIdColumn) {
      const table = await runner.getTable('enterprise_membership');
      if (!table?.foreignKeys.some(fk => this.linksMembershipToUser(fk)))
        await runner.createForeignKey(
          'enterprise_membership',
          new TableForeignKey({
            name: MEMBERSHIP_USER_FK,
            columnNames: [...MEMBERSHIP_USER_COLUMNS],
            referencedTableName: 'user',
            referencedColumnNames: [...USER_ID_COLUMNS],
            onDelete: 'RESTRICT',
          }),
        );
    }
  }

  async down(): Promise<void> {
    throw new Error('Account identity rollback requires a reviewed backup plan.');
  }

  private linksMembershipToUser(foreignKey: {
    columnNames?: string[];
    referencedTableName?: string;
    referencedColumnNames?: string[];
    onDelete?: string;
  }): boolean {
    return (
      sameColumns(foreignKey.columnNames, MEMBERSHIP_USER_COLUMNS) &&
      foreignKey.referencedTableName === 'user' &&
      sameColumns(foreignKey.referencedColumnNames, USER_ID_COLUMNS) &&
      String(foreignKey.onDelete ?? '').toUpperCase() === 'RESTRICT'
    );
  }

  /**
   * TypeORM does not populate Table.engine for MySQL, so fall back to information_schema there.
   * A missing or unreadable engine returns undefined, which the caller turns into a fail-closed
   * engineUnknown diagnostic on MySQL/MariaDB rather than an allowed migration.
   */
  private async tableEngine(
    runner: QueryRunner,
    name: string,
    table?: Table,
  ): Promise<string | undefined> {
    if (table?.engine) return table.engine;
    if (!ENGINE_CHECKED_TYPES.includes(runner.connection.options.type)) return undefined;
    try {
      const [row] = await runner.query(
        'SELECT ENGINE AS value FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [name],
      );
      return row?.['value'] ?? undefined;
    } catch {
      return undefined;
    }
  }
}
