import { DuckDBConnection } from '@duckdb/node-api';

export type FileCorrection = { keyColumn: string; updatedAtColumn: string };
export type FileCorrectionResult = {
  rows: number;
  unchanged: boolean;
  inputRows: number;
  duplicateRowsDropped: number;
  supersededRows: number;
  inserted: number;
  updated: number;
  identical: number;
  ignoredOlder: number;
};
export const FILE_CORRECTION_MESSAGES = {
  FILE_CORRECTION_COLUMNS:
    '업무 키는 문자열·정수, 수정 시점은 날짜·시간 열이어야 합니다. 기존 파일과 같은 열·타입인지 확인해 주세요. 자동 형변환하지 않았습니다.',
  FILE_CORRECTION_KEY:
    '업무 키 또는 수정 시점이 비어 있거나 기존 데이터의 업무 키가 중복됩니다. 키와 수정 시점을 확인해 주세요. 기존 데이터는 유지됩니다.',
  FILE_CORRECTION_AMBIGUOUS:
    '같은 업무 키와 수정 시점에 서로 다른 내용이 있습니다. 어느 행이 최신인지 확인해 수정 시점을 구분한 뒤 다시 올려 주세요. 기존 데이터는 유지됩니다.',
} as const;
export class FileCorrectionError extends Error {
  constructor(
    public readonly code:
      | 'FILE_CORRECTION_COLUMNS'
      | 'FILE_CORRECTION_KEY'
      | 'FILE_CORRECTION_AMBIGUOUS',
  ) {
    super(code);
  }
}
const identifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const invalidColumns = () => new FileCorrectionError('FILE_CORRECTION_COLUMNS');
/** The writable candidate already contains the incoming full rows. Only retained is read-only. */
export async function applyFileCorrection(
  connection: DuckDBConnection,
  retainedFilename: string,
  settings: FileCorrection,
): Promise<FileCorrectionResult> {
  const schema = (
    await connection.runAndReadAll('DESCRIBE uploaded_data')
  ).getRowObjects() as any[];
  if (
    !schema.length ||
    schema.length > 128 ||
    !settings ||
    typeof settings.keyColumn !== 'string' ||
    settings.keyColumn.length > 128 ||
    typeof settings.updatedAtColumn !== 'string' ||
    settings.updatedAtColumn.length > 128 ||
    settings.keyColumn === settings.updatedAtColumn
  )
    throw invalidColumns();
  const keyType = schema.find(c => c.column_name === settings.keyColumn)?.column_type;
  const timeType = schema.find(c => c.column_name === settings.updatedAtColumn)?.column_type;
  if (
    !/^(?:VARCHAR|CHAR|U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|UUID)(?:\(\d+\))?$/.test(
      String(keyType),
    ) ||
    !/^(?:DATE|TIMESTAMP(?:_MS|_NS|_S| WITH TIME ZONE)?)$/.test(String(timeType))
  )
    throw invalidColumns();
  const key = identifier(settings.keyColumn),
    time = identifier(settings.updatedAtColumn);
  const columns = schema.map(c => String(c.column_name));
  let rank = '__correction_rank';
  while (columns.some(name => name.toLowerCase() === rank.toLowerCase())) rank += '_';
  const rankIdentifier = identifier(rank);
  const row = (alias: string) => `ROW(${columns.map(c => `${alias}.${identifier(c)}`).join(', ')})`;
  const n = async (sql: string) =>
    Number((await connection.runAndReadAll(sql)).getRowObjects()[0].n);
  await connection.run(`ATTACH ${literal(retainedFilename)} AS retained (READ_ONLY)`);
  const previousSchema = (
    await connection.runAndReadAll('DESCRIBE SELECT * FROM retained.main.uploaded_data')
  ).getRowObjects() as any[];
  if (
    JSON.stringify(schema.map(c => [c.column_name, c.column_type]).sort()) !==
    JSON.stringify(previousSchema.map(c => [c.column_name, c.column_type]).sort())
  )
    throw invalidColumns();
  const previous = 'retained.main.uploaded_data';
  for (const table of ['uploaded_data', previous]) {
    if (
      await n(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${key} IS NULL OR TRIM(CAST(${key} AS VARCHAR))='' OR ${time} IS NULL`,
      )
    )
      throw new FileCorrectionError('FILE_CORRECTION_KEY');
  }
  if (
    await n(
      `SELECT COUNT(*) AS n FROM (SELECT ${key} FROM ${previous} GROUP BY ${key} HAVING COUNT(*)>1 LIMIT 1)`,
    )
  )
    throw new FileCorrectionError('FILE_CORRECTION_KEY');
  const inputRows = await n('SELECT COUNT(*) AS n FROM uploaded_data');
  const before = await n(`SELECT COUNT(*) AS n FROM ${previous}`);
  await connection.run('BEGIN TRANSACTION');
  try {
    await connection.run(
      'CREATE TEMP TABLE correction_distinct AS SELECT DISTINCT * FROM uploaded_data',
    );
    const distinct = await n('SELECT COUNT(*) AS n FROM correction_distinct');
    if (
      await n(
        `SELECT COUNT(*) AS n FROM (SELECT ${key},${time} FROM correction_distinct GROUP BY ${key},${time} HAVING COUNT(*)>1 LIMIT 1)`,
      )
    )
      throw new FileCorrectionError('FILE_CORRECTION_AMBIGUOUS');
    if (
      await n(
        `SELECT COUNT(*) AS n FROM correction_distinct i INNER JOIN ${previous} o ON i.${key}=o.${key} WHERE i.${time}=o.${time} AND ${row(
          'i',
        )} IS DISTINCT FROM ${row('o')}`,
      )
    )
      throw new FileCorrectionError('FILE_CORRECTION_AMBIGUOUS');
    await connection.run(
      `CREATE TEMP TABLE correction_selected AS SELECT * EXCLUDE (${rankIdentifier}) FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY ${key} ORDER BY ${time} DESC) AS ${rankIdentifier} FROM correction_distinct) WHERE ${rankIdentifier}=1`,
    );
    const selected = await n('SELECT COUNT(*) AS n FROM correction_selected');
    const join = `correction_selected i LEFT JOIN ${previous} o ON i.${key}=o.${key}`;
    const inserted = await n(`SELECT COUNT(*) AS n FROM ${join} WHERE o.${key} IS NULL`);
    const updated = await n(
      `SELECT COUNT(*) AS n FROM ${join} WHERE o.${key} IS NOT NULL AND i.${time}>o.${time}`,
    );
    const identical = await n(
      `SELECT COUNT(*) AS n FROM ${join} WHERE o.${key} IS NOT NULL AND i.${time}=o.${time}`,
    );
    const ignoredOlder = await n(
      `SELECT COUNT(*) AS n FROM ${join} WHERE o.${key} IS NOT NULL AND i.${time}<o.${time}`,
    );
    if (inserted || updated) {
      const projection = (alias: string) =>
        columns.map(c => `${alias}.${identifier(c)}`).join(', ');
      await connection.run(
        `CREATE TEMP TABLE correction_next AS SELECT ${projection(
          'o',
        )} FROM ${previous} o LEFT JOIN correction_selected i ON i.${key}=o.${key} WHERE i.${key} IS NULL OR i.${time}<=o.${time} UNION ALL SELECT ${projection(
          'i',
        )} FROM ${join} WHERE o.${key} IS NULL OR i.${time}>o.${time}`,
      );
      await connection.run('DELETE FROM uploaded_data');
      await connection.run('INSERT INTO uploaded_data SELECT * FROM correction_next');
    }
    await connection.run('COMMIT');
    return {
      rows: before + inserted,
      unchanged: inserted + updated === 0,
      inputRows,
      duplicateRowsDropped: inputRows - distinct,
      supersededRows: distinct - selected,
      inserted,
      updated,
      identical,
      ignoredOlder,
    };
  } catch (error) {
    await connection.run('ROLLBACK');
    throw error;
  }
}
