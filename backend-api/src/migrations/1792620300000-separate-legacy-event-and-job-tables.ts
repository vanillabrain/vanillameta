import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumnOptions,
  TableForeignKey,
} from 'typeorm';

/** Additive separation. Legacy shared tables are deliberately never mapped, altered or removed. */
export class SeparateLegacyEventAndJobTables1792620300000 implements MigrationInterface {
  private text(name: string, nullable = true): TableColumnOptions {
    return { name, type: 'text', isNullable: nullable };
  }
  private varchar(name: string, length: number, nullable = true): TableColumnOptions {
    return { name, type: 'varchar', length: String(length), isNullable: nullable };
  }
  private date(
    runner: QueryRunner,
    name: string,
    nullable = true,
    type: 'datetime' | 'timestamp' = 'datetime',
    generated?: 'created' | 'updated',
  ): TableColumnOptions {
    const mysql = runner.connection.options.type === 'mysql';
    return {
      name,
      type: mysql ? type : 'datetime',
      isNullable: nullable,
      ...(generated
        ? {
            ...(mysql ? { precision: 6 } : {}),
            default: mysql ? 'CURRENT_TIMESTAMP(6)' : 'CURRENT_TIMESTAMP',
            ...(mysql && generated === 'updated' ? { onUpdate: 'CURRENT_TIMESTAMP(6)' } : {}),
          }
        : {}),
    };
  }
  private integer(name: string, defaultValue = 0): TableColumnOptions {
    return { name, type: 'int', default: defaultValue };
  }
  private async create(
    runner: QueryRunner,
    name: string,
    columns: TableColumnOptions[],
    link?: [string, string, string],
  ) {
    if (await runner.hasTable(name)) return;
    const foreignKeys =
      link && (await runner.hasTable(link[1]))
        ? [
            new TableForeignKey({
              columnNames: [link[0]],
              referencedTableName: link[1],
              referencedColumnNames: [link[2]],
            }),
          ]
        : [];
    await runner.createTable(
      new Table({
        name,
        columns: [{ ...this.varchar('id', 36, false), isPrimary: true }, ...columns],
        foreignKeys,
      }),
    );
  }
  private async copy(runner: QueryRunner, source: string, target: string, condition: string) {
    const old = await runner.getTable(source),
      next = await runner.getTable(target);
    if (!old || !next) return;
    const columns = next.columns.filter(column => old.findColumnByName(column.name));
    // Never synthesize required history or silently coerce an incomplete old schema.
    const required = next.columns.filter(column => !column.isNullable);
    const preserved = [
      ...required,
      ...next.columns.filter(column => ['createdAt', 'expiresAt'].includes(column.name)),
    ];
    if (preserved.some(column => !old.findColumnByName(column.name))) return;
    const e = (name: string) => runner.connection.driver.escape(name);
    const guards = [condition, ...required.map(column => `s.${e(column.name)} IS NOT NULL`)];
    const parentLink =
      target === 'background_job_results'
        ? 'backgroundJobId'
        : target === 'queued_job_results'
        ? 'jobId'
        : undefined;
    if (parentLink)
      guards.push(
        `NOT EXISTS (SELECT 1 FROM ${e(target)} linked WHERE linked.${e(parentLink)} = s.${e(
          parentLink,
        )})`,
      );

    const charLength = runner.connection.options.type === 'mysql' ? 'CHAR_LENGTH' : 'LENGTH';
    for (const column of columns) {
      const sourceColumn = old.findColumnByName(column.name);
      if (
        runner.connection.options.type === 'mysql' &&
        ['datetime', 'timestamp'].includes(column.type) &&
        (sourceColumn.precision ?? 0) > (column.precision ?? 0)
      ) {
        const unit = 10 ** (6 - (column.precision ?? 0));
        // Keep the entire row in legacy storage if a plain precision-0 entity field
        // cannot represent its history. Audit fields use precision 6 and copy directly.
        guards.push(
          `(s.${e(column.name)} IS NULL OR MOD(MICROSECOND(s.${e(column.name)}), ${unit}) = 0)`,
        );
      }
      if (column.length)
        guards.push(
          `(s.${e(column.name)} IS NULL OR ${charLength}(s.${e(column.name)}) <= ${Number(
            column.length,
          )})`,
        );
    }
    const names = columns.map(column => e(column.name)).join(', ');
    // Existing destination IDs are retained even if their bytes differ. No UPSERT/REPLACE.
    await runner.query(`INSERT INTO ${e(target)} (${names}) SELECT ${columns
      .map(column => `s.${e(column.name)}`)
      .join(', ')}
      FROM ${e(source)} s WHERE ${guards.join(' AND ')}
      AND NOT EXISTS (SELECT 1 FROM ${e(target)} d WHERE d.${e('id')} = s.${e('id')})`);
  }
  async up(runner: QueryRunner): Promise<void> {
    await this.create(
      runner,
      'background_job_results',
      [
        { ...this.varchar('backgroundJobId', 100, false), isUnique: true },
        { ...this.varchar('storageType', 50, false), default: "'database'" },
        this.text('resultData'),
        this.varchar('storageLocation', 500),
        { name: 'resultSizeBytes', type: 'bigint', default: 0 },
        this.integer('rowCount'),
        this.text('resultMetadata'),
        { ...this.date(runner, 'expiresAt', false), default: 'CURRENT_TIMESTAMP' },
        { name: 'isCompressed', type: 'boolean', default: false },
        this.varchar('compressionType', 50),
        this.date(runner, 'createdAt', true, 'datetime', 'created'),
        this.date(runner, 'updatedAt', true, 'datetime', 'updated'),
      ],
      ['backgroundJobId', 'background_jobs', 'id'],
    );
    await this.create(
      runner,
      'queued_job_results',
      [
        { ...this.varchar('jobId', 36, false), isUnique: true },
        this.varchar('resultType', 50, false),
        this.text('resultData'),
        this.varchar('downloadUrl', 255),
        this.varchar('fileName', 255),
        { name: 'fileSizeBytes', type: 'bigint', isNullable: true },
        this.varchar('mimeType', 100),
        this.date(runner, 'expiresAt'),
        { name: 'isDownloaded', type: 'boolean', default: false },
        this.integer('downloadCount'),
        this.text('metadata'),
        this.date(runner, 'createdAt', false, 'datetime', 'created'),
      ],
      ['jobId', 'queue_jobs', 'id'],
    );
    await this.create(runner, 'analytics_collected_events', [
      this.varchar('category', 50, false),
      this.varchar('action', 100, false),
      this.varchar('label', 255),
      { name: 'value', type: 'int', isNullable: true },
      this.varchar('userId', 36),
      this.varchar('sessionId', 100, false),
      this.varchar('correlationId', 36),
      this.text('metadata'),
      this.varchar('userAgent', 500),
      this.varchar('screenResolution', 20),
      this.varchar('viewport', 20),
      this.text('url'),
      this.text('referrer'),
      this.varchar('ipAddress', 45),
      ...['country', 'region'].map(name => this.varchar(name, 10)),
      this.varchar('city', 100),
      ...['browser', 'browserVersion', 'os', 'osVersion', 'device'].map(name =>
        this.varchar(name, 50),
      ),
      this.date(runner, 'createdAt', false, 'timestamp', 'created'),
      this.date(runner, 'eventTimestamp', true, 'timestamp'),
    ]);
    await this.create(
      runner,
      'client_analytics_events',
      [
        this.varchar('action', 100, false),
        this.varchar('category', 50, false),
        this.varchar('label', 255),
        { name: 'value', type: 'decimal', precision: 10, scale: 2, isNullable: true },
        this.varchar('userId', 36),
        this.varchar('sessionId', 36, false),
        this.varchar('correlationId', 36, false),
        { name: 'properties', type: 'json', isNullable: true },
        { name: 'userProperties', type: 'json', isNullable: true },
        this.varchar('anonymizedIp', 45),
        this.text('userAgent'),
        this.text('pageUrl'),
        this.text('referrer'),
        this.date(runner, 'createdAt', false, 'datetime', 'created'),
      ],
      ['sessionId', 'event_sessions', 'sessionId'],
    );

    const e = (name: string) => runner.connection.driver.escape(name);
    const results = await runner.getTable('job_results');
    for (const [key, other, parent, target] of [
      ['backgroundJobId', 'jobId', 'background_jobs', 'background_job_results'],
      ['jobId', 'backgroundJobId', 'queue_jobs', 'queued_job_results'],
    ]) {
      if (!results?.findColumnByName(key) || !(await runner.hasTable(parent))) continue;
      const condition = [
        `s.${e(key)} IS NOT NULL`,
        results.findColumnByName(other) ? `s.${e(other)} IS NULL` : '1=1',
        `EXISTS (SELECT 1 FROM ${e(parent)} p WHERE p.${e('id')} = s.${e(key)})`,
        `(SELECT COUNT(*) FROM ${e('job_results')} duplicate_link WHERE duplicate_link.${e(
          key,
        )} = s.${e(key)}) = 1`,
      ].join(' AND ');
      await this.copy(runner, 'job_results', target, condition);
    }
    const events = await runner.getTable('analytics_events');
    if (!events) return;
    const collectedMarkers = [
      'metadata',
      'screenResolution',
      'viewport',
      'url',
      'ipAddress',
      'country',
      'region',
      'city',
      'browser',
      'browserVersion',
      'os',
      'osVersion',
      'device',
      'eventTimestamp',
    ];
    const clientMarkers = ['properties', 'userProperties', 'anonymizedIp', 'pageUrl'];
    for (const [target, ownMarkers, otherMarkers] of [
      ['analytics_collected_events', collectedMarkers, clientMarkers],
      ['client_analytics_events', clientMarkers, collectedMarkers],
    ] as const) {
      const own = ownMarkers.filter(name => events.findColumnByName(name));
      const other = otherMarkers.filter(name => events.findColumnByName(name));
      if (!own.length) continue;
      const guards = [
        other.length ? `(${own.map(name => `s.${e(name)} IS NOT NULL`).join(' OR ')})` : '1=1',
        ...other.map(name => `s.${e(name)} IS NULL`),
      ];
      for (const name of target === 'analytics_collected_events'
        ? ['metadata']
        : ['properties', 'userProperties'])
        if (events.findColumnByName(name))
          guards.push(`(s.${e(name)} IS NULL OR JSON_VALID(s.${e(name)}))`);
      if (events.findColumnByName('value')) {
        const cast = runner.connection.options.type === 'mysql' ? 'SIGNED' : 'INTEGER';
        guards.push(
          target === 'analytics_collected_events'
            ? `(s.${e('value')} IS NULL OR (s.${e('value')} = CAST(s.${e(
                'value',
              )} AS ${cast}) AND s.${e('value')} BETWEEN -2147483648 AND 2147483647))`
            : `(s.${e('value')} IS NULL OR (ABS(s.${e('value')}) < 100000000 AND ROUND(s.${e(
                'value',
              )}, 2) = s.${e('value')}))`,
        );
      }
      if (target === 'client_analytics_events') {
        if (!(await runner.hasTable('event_sessions')) || !events.findColumnByName('sessionId'))
          continue;
        guards.push(
          `EXISTS (SELECT 1 FROM ${e('event_sessions')} p WHERE p.${e('sessionId')} = s.${e(
            'sessionId',
          )})`,
        );
      }
      await this.copy(runner, 'analytics_events', target, guards.join(' AND '));
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Legacy table separation rollback requires a reviewed preservation plan; no tables or history are dropped.',
    );
  }
}
