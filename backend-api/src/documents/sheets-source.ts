import { ServiceUnavailableException } from '@nestjs/common';
import { toCsv } from './google-sheets.provider';

export const SHEETS_MAX_COLUMNS = 50;
export const SHEETS_MAX_CELL_LENGTH = 1000;

/** Turns sheet values into a CSV a DuckDB source can import, or refuses an unsafe sheet. */
export function buildSheetCsv(rows: string[][]) {
  const trimmed = rows.filter(row => row.some(cell => cell.trim() !== ''));
  if (trimmed.length < 2)
    throw new ServiceUnavailableException('시트에 헤더와 데이터 행이 각각 1줄 이상 필요합니다.');
  const columns = trimmed[0].map(cell => cell.trim());
  if (columns.some(column => !column))
    throw new ServiceUnavailableException('헤더에 빈 열이 있습니다.');
  if (new Set(columns).size !== columns.length)
    throw new ServiceUnavailableException('헤더 이름이 중복됩니다.');
  if (columns.length > SHEETS_MAX_COLUMNS)
    throw new ServiceUnavailableException('열이 ' + SHEETS_MAX_COLUMNS + '개를 넘습니다.');
  const body = trimmed.slice(1).map(row => {
    const cells = columns.map((_, index) => row[index] ?? '');
    if (cells.some(cell => cell.length > SHEETS_MAX_CELL_LENGTH))
      throw new ServiceUnavailableException('셀 값이 ' + SHEETS_MAX_CELL_LENGTH + '자를 넘습니다.');
    return cells;
  });
  return { csv: toCsv([columns, ...body]), columns, rowCount: body.length };
}

/** Builds the upload that DatabaseService.uploadFile imports into DuckDB and registers as a source. */
export function sheetUploadFile(name: string, rows: string[][]) {
  const { csv, columns, rowCount } = buildSheetCsv(rows);
  const base = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 80);
  return {
    originalname: (base || 'sheet') + '.csv',
    buffer: Buffer.from(csv, 'utf8'),
    columns,
    rowCount,
  };
}

