<<<<<<< HEAD
import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';
=======
// Temporarily disabled for local development
/*
import { MigrationInterface, QueryRunner, Index } from 'typeorm';
>>>>>>> task/T001

export class AddDatabaseIndexes1736723000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dashboard indexes
    await queryRunner.createIndex(
      'dashboard',
      new TableIndex({
        name: 'IDX_DASHBOARD_UPDATED_AT',
        columnNames: ['updatedAt'],
      }),
    );

    await queryRunner.createIndex(
      'dashboard',
      new TableIndex({
        name: 'IDX_DASHBOARD_UPDATED_AT_TITLE',
        columnNames: ['updatedAt', 'title'],
      }),
    );

    // Widget indexes
    await queryRunner.createIndex(
      'widget',
      new TableIndex({
        name: 'IDX_WIDGET_COMPONENT_ID',
        columnNames: ['componentId'],
      }),
    );

    await queryRunner.createIndex(
      'widget',
      new TableIndex({
        name: 'IDX_WIDGET_DATASET_TYPE_ID',
        columnNames: ['datasetType', 'datasetId'],
      }),
    );

    await queryRunner.createIndex(
      'widget',
      new TableIndex({
        name: 'IDX_WIDGET_UPDATED_AT',
        columnNames: ['updatedAt'],
      }),
    );

    // Dataset indexes
    await queryRunner.createIndex(
      'dataset',
      new TableIndex({
        name: 'IDX_DATASET_DATABASE_ID',
        columnNames: ['databaseId'],
      }),
    );

    // User indexes
    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'IDX_USER_USER_ID',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    // Email index might already exist, so we check first
    const emailIndex = await queryRunner.getTable('user');
    const hasEmailIndex = emailIndex?.indices.some(index => index.columnNames.includes('email'));

    if (!hasEmailIndex) {
      await queryRunner.createIndex(
        'user',
        new TableIndex({
          name: 'IDX_USER_EMAIL',
          columnNames: ['email'],
          isUnique: true,
        }),
      );
    }

    // UserMapping indexes
    await queryRunner.createIndex(
      'user_mapping',
      new TableIndex({
        name: 'IDX_USER_MAPPING_USER_INFO_ID',
        columnNames: ['userInfoId'],
      }),
    );

    await queryRunner.createIndex(
      'user_mapping',
      new TableIndex({
        name: 'IDX_USER_MAPPING_DASHBOARD_ID',
        columnNames: ['dashboardId'],
      }),
    );

    // TableQuery indexes
    await queryRunner.createIndex(
      'table_query',
      new TableIndex({
        name: 'IDX_TABLE_QUERY_DATABASE_ID',
        columnNames: ['databaseId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes in reverse order
    await queryRunner.dropIndex('table_query', 'IDX_TABLE_QUERY_DATABASE_ID');

    await queryRunner.dropIndex('user_mapping', 'IDX_USER_MAPPING_DASHBOARD_ID');
    await queryRunner.dropIndex('user_mapping', 'IDX_USER_MAPPING_USER_INFO_ID');

    const emailIndex = await queryRunner.getTable('user');
    const hasEmailIndex = emailIndex?.indices.some(index => index.name === 'IDX_USER_EMAIL');
    if (hasEmailIndex) {
      await queryRunner.dropIndex('user', 'IDX_USER_EMAIL');
    }
    await queryRunner.dropIndex('user', 'IDX_USER_USER_ID');

    await queryRunner.dropIndex('dataset', 'IDX_DATASET_DATABASE_ID');

    await queryRunner.dropIndex('widget', 'IDX_WIDGET_UPDATED_AT');
    await queryRunner.dropIndex('widget', 'IDX_WIDGET_DATASET_TYPE_ID');
    await queryRunner.dropIndex('widget', 'IDX_WIDGET_COMPONENT_ID');

    await queryRunner.dropIndex('dashboard', 'IDX_DASHBOARD_UPDATED_AT_TITLE');
    await queryRunner.dropIndex('dashboard', 'IDX_DASHBOARD_UPDATED_AT');
  }
}
*/

// Empty class for local development
export class AddDatabaseIndexes1736723000000 {
  public async up(): Promise<void> {
    // Migration disabled for local development
  }

  public async down(): Promise<void> {
    // Migration disabled for local development
  }
}
