import { BadRequestException } from '@nestjs/common';

/** Only for SQL produced by the validated sourceQuery compiler, never arbitrary
 * SQL. Persist primitive bindings without changing protected quoted question marks.
 * UTF8 hex avoids the legacy DuckDB semicolon guard, including inside values. */
export function renderValidatedQueryBindings(sql: string, bindings: readonly unknown[]): string {
  const invalid = (): never => {
    throw new BadRequestException('Invalid generated query bindings');
  };
  if (typeof sql !== 'string' || !Array.isArray(bindings)) invalid();
  let result = '';
  let index = 0;
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      result += char;
      if (char === quote) {
        if (sql[i + 1] === quote) result += sql[++i];
        else quote = undefined;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      result += char;
    } else if (
      char === ';' ||
      sql.slice(i, i + 2) === '--' ||
      sql.slice(i, i + 2) === '/*' ||
      sql.slice(i, i + 2) === '*/'
    ) {
      invalid();
    } else if (char === '?') {
      if (index >= bindings.length) invalid();
      const value = bindings[index++];
      if (value === null) result += 'NULL';
      else if (typeof value === 'boolean') result += value ? 'TRUE' : 'FALSE';
      else if (typeof value === 'number' && Number.isFinite(value))
        result += Number.isSafeInteger(value)
          ? `CAST('${value}' AS BIGINT)`
          : `CAST('${value}' AS DOUBLE)`;
      else if (typeof value === 'string')
        result += `decode(from_hex('${Buffer.from(value, 'utf8').toString('hex')}'))`;
      else invalid();
    } else result += char;
    if (Buffer.byteLength(result, 'utf8') > 60000) invalid();
  }
  if (quote || index !== bindings.length) invalid();
  return result;
}
