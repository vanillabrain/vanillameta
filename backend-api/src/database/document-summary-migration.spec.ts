import { Table } from 'typeorm';
import { AddDocumentSummary1793520000000 } from '../migrations/postgres/1793520000000-add-document-summary';

describe('document summary PostgreSQL migration', () => {
  it('creates the same columns as the entity and skips an existing table', async () => {
    const tables: Table[] = [];
    const runner = {
      hasTable: jest.fn(async () => false),
      createTable: jest.fn(async (table: Table) => {
        tables.push(table);
      }),
    };
    await new AddDocumentSummary1793520000000().up(runner as never);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('document_summary');
    expect(tables[0].columns.map(column => column.name)).toEqual([
      'documentId',
      'version',
      'ownerId',
      'organizationId',
      'sourceSha256',
      'summary',
      'generatedAt',
    ]);
    expect(tables[0].columns.filter(column => column.isPrimary).map(column => column.name)).toEqual(
      ['documentId', 'version'],
    );
    expect(tables[0].columns.find(column => column.name === 'summary')?.type).toBe('text');
  });
  it('leaves an existing table untouched', async () => {
    const runner = { hasTable: jest.fn(async () => true), createTable: jest.fn() };
    await new AddDocumentSummary1793520000000().up(runner as never);
    expect(runner.createTable).not.toHaveBeenCalled();
  });
});
