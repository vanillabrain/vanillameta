import { DuckDBConnection } from '@duckdb/node-api';
export class FileLookupError extends Error {
  readonly code = 'FILE_LOOKUP_INVALID';
}

export type FileLookup = {
  factKey: string;
  lookupKey: string;
  attributes: { column: string; alias: string }[];
  pathColumn?: string;
  nonAdditiveColumns: string[];
};
export type FileLookupQuality = {
  factRows: number;
  lookupRows: number;
  duplicateLookupKeys: number;
  invalidLookupKeys: number;
  unmatchedFactRows: number | null;
  unusedLookupRows: number | null;
  outputRows: number | null;
  ready: boolean;
};
const identifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`;
const numeric = /^(?:U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|FLOAT|DOUBLE|DECIMAL)/;
const keyType =
  /^(?:VARCHAR|CHAR|U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|UUID)(?:\(\d+\))?$/;
const field = (value: any) => typeof value === 'string' && !!value.trim() && value.length <= 128;
export function fileLookupDefinition(value: any): FileLookup {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      key =>
        !['factKey', 'lookupKey', 'attributes', 'pathColumn', 'nonAdditiveColumns'].includes(key),
    ) ||
    !field(value.factKey) ||
    !field(value.lookupKey) ||
    !Array.isArray(value.attributes) ||
    value.attributes.length < 1 ||
    value.attributes.length > 8 ||
    value.attributes.some(
      (a: any) =>
        !a ||
        typeof a !== 'object' ||
        Array.isArray(a) ||
        Object.keys(a).sort().join(',') !== 'alias,column' ||
        !field(a.column) ||
        typeof a.alias !== 'string' ||
        !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(a.alias),
    ) ||
    (value.pathColumn !== undefined && !field(value.pathColumn)) ||
    (value.nonAdditiveColumns !== undefined &&
      (!Array.isArray(value.nonAdditiveColumns) ||
        value.nonAdditiveColumns.length > 128 ||
        value.nonAdditiveColumns.some((c: any) => !field(c))))
  )
    throw new FileLookupError('연결할 키·속성·비가산 열 설정을 확인해 주세요.');
  const nonAdditiveColumns = [...new Set<string>(value.nonAdditiveColumns ?? [])].sort();
  return {
    factKey: value.factKey,
    lookupKey: value.lookupKey,
    attributes: value.attributes.map((a: any) => ({ column: a.column, alias: a.alias })),
    ...(value.pathColumn !== undefined ? { pathColumn: value.pathColumn } : {}),
    nonAdditiveColumns,
  };
}

/** Both inputs are immutable, read-only attachments; only a separate candidate can be written. */
export async function buildFileLookup(
  connection: DuckDBConnection,
  factFilename: string,
  lookupFilename: string,
  input: FileLookup,
  materialize: boolean,
  maxResultBytes = 8 * 1024 * 1024,
) {
  const definition = fileLookupDefinition(input);
  await connection.run(`ATTACH ${literal(factFilename)} AS fact_input (READ_ONLY)`);
  await connection.run(`ATTACH ${literal(lookupFilename)} AS lookup_input (READ_ONLY)`);
  const fact = 'fact_input.main.uploaded_data',
    lookup = 'lookup_input.main.uploaded_data';
  const schema = async (table: string) =>
    (await connection.runAndReadAll(`DESCRIBE SELECT * FROM ${table}`)).getRowObjects() as any[];
  const facts = await schema(fact),
    lookups = await schema(lookup);
  const fk = facts.find(c => c.column_name === definition.factKey);
  const lk = lookups.find(c => c.column_name === definition.lookupKey);
  if (!fk || !lk || !keyType.test(fk.column_type) || fk.column_type !== lk.column_type)
    throw new FileLookupError(
      '두 키는 같은 문자열 또는 정수 타입이어야 합니다. 자동 형변환하지 않았습니다.',
    );
  const names = new Set<string>(facts.map(c => String(c.column_name).toLowerCase()));
  const extra: string[] = [];
  for (const attr of definition.attributes) {
    const column = lookups.find(c => c.column_name === attr.column);
    if (!column || /STRUCT|MAP|\[/.test(column.column_type) || names.has(attr.alias.toLowerCase()))
      throw new FileLookupError(
        '속성 열이 없거나 출력 이름이 기존 열과 겹칩니다. 이름을 구분해 주세요.',
      );
    names.add(attr.alias.toLowerCase());
    // Lookup attributes are dimensions, never repeated additive parent measures.
    extra.push(`CAST(l.${identifier(attr.column)} AS VARCHAR) AS ${identifier(attr.alias)}`);
  }
  if (definition.pathColumn) {
    const column = facts.find(c => c.column_name === definition.pathColumn);
    if (!column || column.column_type !== 'VARCHAR')
      throw new FileLookupError('파일 경로는 문자열 열을 선택해 주세요.');
    const path = `f.${identifier(definition.pathColumn)}`;
    const filename = `parse_filename(${path}, false, 'forward_slash')`;
    for (const [name, expression] of [
      ['path_filename', filename],
      ['path_directory', `parse_dirpath(${path}, 'forward_slash')`],
      ['path_extension', `regexp_extract(${filename}, '^.+\\.([^.]+)$', 1)`],
    ]) {
      if (names.has(name)) throw new FileLookupError('경로 파생 열 이름이 기존 열과 겹칩니다.');
      names.add(name);
      extra.push(`${expression} AS ${identifier(name)}`);
    }
  }
  if (names.size > 128 || facts.length < 1)
    throw new FileLookupError('연결 결과는 최대128개 열을 지원합니다.');
  for (const name of definition.nonAdditiveColumns) {
    const column = facts.find(c => c.column_name === name);
    if (!column || (!numeric.test(column.column_type) && column.column_type !== 'VARCHAR'))
      throw new FileLookupError('비가산 값은 기존 숫자·범주 열을 선택해 주세요.');
  }
  const n = async (sql: string) =>
    Number((await connection.runAndReadAll(sql)).getRowObjects()[0].n);
  const factKey = identifier(definition.factKey),
    lookupKey = identifier(definition.lookupKey);
  const quality: FileLookupQuality = {
    factRows: await n(`SELECT COUNT(*) AS n FROM ${fact}`),
    lookupRows: await n(`SELECT COUNT(*) AS n FROM ${lookup}`),
    duplicateLookupKeys: await n(
      `SELECT COUNT(*) AS n FROM (SELECT ${lookupKey} FROM ${lookup} GROUP BY 1 HAVING COUNT(*)>1)`,
    ),
    invalidLookupKeys: await n(
      `SELECT COUNT(*) AS n FROM ${lookup} WHERE ${lookupKey} IS NULL OR TRIM(CAST(${lookupKey} AS VARCHAR))=''`,
    ),
    unmatchedFactRows: null,
    unusedLookupRows: null,
    outputRows: null,
    ready: false,
  };
  if (quality.duplicateLookupKeys || quality.invalidLookupKeys)
    return { definition, quality, preview: [] };
  const join = `FROM ${fact} f LEFT JOIN ${lookup} l ON f.${factKey}=l.${lookupKey}`;
  quality.unmatchedFactRows = await n(`SELECT COUNT(*) AS n ${join} WHERE l.${lookupKey} IS NULL`);
  quality.unusedLookupRows = await n(
    `SELECT COUNT(*) AS n FROM ${lookup} l WHERE NOT EXISTS (SELECT 1 FROM ${fact} f WHERE f.${factKey}=l.${lookupKey})`,
  );
  const select = `SELECT f.*, ${extra.join(', ')} ${join}`;
  quality.outputRows = await n(`SELECT COUNT(*) AS n FROM (${select})`);
  if (quality.outputRows !== quality.factRows)
    throw new FileLookupError('연결 전후 원본 행 수가 달라 저장하지 않았습니다.');
  quality.ready = true;
  const reader = await connection.runAndReadAll(`${select} ORDER BY ALL LIMIT 5`);
  let bytes = 0;
  const namesInPreview = reader.columnNames();
  for (let row = 0; row < reader.currentRowCount; row++) {
    for (let column = 0; column < reader.columnCount; column++) {
      const value = reader.value(column, row);
      const size = typeof value === 'string' ? Buffer.byteLength(value) : 32;
      bytes += size + Buffer.byteLength(namesInPreview[column]) + 16;
      if (size > 1024 * 1024 || bytes > maxResultBytes)
        throw new FileLookupError(
          '연결 미리보기 결과가 큽니다. 큰 텍스트 열을 줄인 뒤 다시 확인해 주세요. 원본은 유지됩니다.',
        );
    }
  }
  const preview = reader.getRowObjects();
  if (materialize) {
    await connection.run(`CREATE TABLE uploaded_data AS ${select}`);
    await connection.run('CHECKPOINT');
  }
  return { definition, quality, preview };
}
