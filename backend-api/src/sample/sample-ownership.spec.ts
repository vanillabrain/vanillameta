import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SampleService } from './sample.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { YesNo } from '../common/enum/yn.enum';

describe('SampleService private sample asset ownership', () => {
  let service: SampleService;
  let uploadDir: string;
  let databases: any[];
  let datasets: any[];
  let widgets: any[];
  let repositories: Record<string, any>;
  const oldUploadDir = process.env.FILE_UPLOAD_DIR;
  const oldConfigSecret = process.env.CONFIG_SECRET_KEY;

  beforeEach(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-sample-ownership-'));
    process.env.FILE_UPLOAD_DIR = uploadDir;
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    databases = [{ id: 1, name: '샘플 매출 데이터', ownerId: null }];
    datasets = [{ id: 1, title: '샘플: 지역별 매출', databaseId: 1 }];
    widgets = [
      { id: 1, title: '샘플: 이번 달 총 매출', datasetId: 1, componentId: 100 },
      { id: 2, title: '샘플: 지역별 매출 추이', datasetId: 1, componentId: 101 },
    ];
    let databaseId = 1;
    let datasetId = 1;
    let widgetId = 2;
    repositories = {
      Database: {
        findOne: jest.fn(({ where }) =>
          Promise.resolve(
            databases.find(row =>
              where.id !== undefined
                ? row.id === where.id
                : row.name === where.name && row.ownerId === where.ownerId,
            ) || null,
          ),
        ),
        save: jest.fn(async row => {
          const saved = { ...row, id: ++databaseId };
          databases.push(saved);
          return saved;
        }),
        manager: { connection: { options: { type: 'mysql' } } },
      },
      Dataset: {
        findOne: jest.fn(({ where }) =>
          Promise.resolve(
            datasets.find(
              row => row.title === where.title && row.databaseId === where.databaseId,
            ) || null,
          ),
        ),
        save: jest.fn(async row => {
          const saved = { ...row, id: ++datasetId };
          datasets.push(saved);
          return saved;
        }),
      },
      Widget: {
        findOne: jest.fn(({ where }) =>
          Promise.resolve(
            widgets.find(
              row =>
                row.datasetId === where.datasetId &&
                row.datasetType === where.datasetType &&
                row.componentId === where.componentId &&
                row.delYn === where.delYn,
            ) || null,
          ),
        ),
        save: jest.fn(async row => {
          const saved = { ...row, id: ++widgetId };
          widgets.push(saved);
          return saved;
        }),
      },
      Component: {
        findOne: jest.fn(({ where }) =>
          Promise.resolve({ id: where.type === 'BOARD_NUMERIC' ? 100 : 101, type: where.type }),
        ),
      },
      Dashboard: { findOne: jest.fn(), save: jest.fn() },
      DashboardShare: { save: jest.fn() },
      DashboardWidget: { save: jest.fn() },
      UserMapping: { find: jest.fn(), save: jest.fn() },
    };
    const connection: any = { options: { type: 'mysql' } };
    const manager: any = {
      connection,
      queryRunner: { isTransactionActive: false },
      findOne: jest.fn((entity, options) => repositories[entity.name].findOne(options)),
      save: jest.fn((entity, value) => repositories[entity.name].save(value)),
    };
    connection.transaction = jest.fn(async run => {
      manager.queryRunner.isTransactionActive = true;
      try {
        return await run(manager);
      } finally {
        manager.queryRunner.isTransactionActive = false;
      }
    });
    repositories.Database.manager = manager;
    const entities = [
      Database,
      Dataset,
      Widget,
      Component,
      Dashboard,
      DashboardShare,
      DashboardWidget,
      UserMapping,
    ];
    const providers = [
      SampleService,
      ...entities.map(entity => ({
        provide: getRepositoryToken(entity),
        useValue: repositories[entity.name],
      })),
    ];
    const module: TestingModule = await Test.createTestingModule({ providers }).compile();
    service = module.get(SampleService);
  });

  afterEach(() => {
    if (oldUploadDir === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldUploadDir;
    if (oldConfigSecret === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = oldConfigSecret;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('creates isolated owner sources and reuses only that owner’s dataset and widgets', async () => {
    const assetsFor = async (ownerId: number) => {
      const dataset = await (service as any).ensureSampleAssets(ownerId);
      const ownerWidgets = await (service as any).ensureSampleWidgets(dataset.id);
      return { dataset, ownerWidgets };
    };

    const first = await assetsFor(7);
    const firstAgain = await assetsFor(7);
    const second = await assetsFor(8);

    expect(repositories.Database.findOne).toHaveBeenCalledWith({
      where: { name: '샘플 매출 데이터', ownerId: 7 },
    });
    expect(databases.find(row => row.id === first.dataset.databaseId)).toEqual(
      expect.objectContaining({ ownerId: 7 }),
    );
    expect(databases.find(row => row.id === second.dataset.databaseId)).toEqual(
      expect.objectContaining({ ownerId: 8 }),
    );
    expect(databases.find(row => row.id === 1).ownerId).toBeNull();
    expect(firstAgain.dataset.id).toBe(first.dataset.id);
    expect(firstAgain.ownerWidgets.map(widget => widget.id)).toEqual(
      first.ownerWidgets.map(widget => widget.id),
    );
    expect(first.dataset.databaseId).not.toBe(second.dataset.databaseId);
    expect(first.ownerWidgets.every(widget => widget.datasetId === first.dataset.id)).toBe(true);
    expect(second.ownerWidgets.every(widget => widget.datasetId === second.dataset.id)).toBe(true);
    expect(widgets.filter(widget => widget.datasetId === 1)).toHaveLength(2);
    expect(widgets.filter(widget => widget.datasetId === first.dataset.id)).toHaveLength(2);
    expect(widgets.filter(widget => widget.datasetId === second.dataset.id)).toHaveLength(2);
    expect(repositories.Widget.findOne).toHaveBeenCalledWith({
      where: {
        datasetId: first.dataset.id,
        datasetType: DatasetType.DATASET,
        componentId: 100,
        delYn: YesNo.NO,
      },
    });
  });
});
