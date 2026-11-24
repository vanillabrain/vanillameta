import { Table } from 'typeorm';
import { AddAiArtifact1793550000000 } from '../migrations/postgres/1793550000000-add-ai-artifact';

describe('ai_artifact PostgreSQL migration', () => {
  it('creates the entity columns and the owner index', async () => {
    const tables: Table[] = [];
    const runner = {
      hasTable: jest.fn(async () => false),
      createTable: jest.fn(async (table: Table) => {
        tables.push(table);
      }),
    };
    await new AddAiArtifact1793550000000().up(runner as never);
    expect(tables).toHaveLength(1);
    expect(tables[0].columns.map(column => column.name)).toEqual([
      'id',
      'ownerId',
      'organizationId',
      'kind',
      'title',
      'content',
      'revision',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
    expect(tables[0].indices.map(index => index.name)).toEqual(['IDX_ai_artifact_owner']);
  });
  it('leaves an existing table untouched', async () => {
    const runner = { hasTable: jest.fn(async () => true), createTable: jest.fn() };
    await new AddAiArtifact1793550000000().up(runner as never);
    expect(runner.createTable).not.toHaveBeenCalled();
  });
});
