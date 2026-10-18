import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SampleService } from './sample.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { YesNo } from '../common/enum/yn.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  manager: { connection: { options: { type: 'mysql' } } },
});

describe('SampleService', () => {
  let service: SampleService;
  let repos: Record<string, ReturnType<typeof mockRepo>>;
  let uploadDir: string;
  const prevUploadDir = process.env.FILE_UPLOAD_DIR;

  beforeEach(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-sample-'));
    process.env.FILE_UPLOAD_DIR = uploadDir;
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    repos = {};
    const providers = [
      SampleService,
      ...[
        Database,
        Dataset,
        Widget,
        Component,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
      ].map(e => {
        const name = e.name;
        repos[name] = mockRepo();
        return { provide: getRepositoryToken(e), useValue: repos[name] };
      }),
    ];
    const module: TestingModule = await Test.createTestingModule({ providers }).compile();
    service = module.get<SampleService>(SampleService);
    // Reuse the actual mocked save result for the locked reread, never fabricate a parent.
    const tx: any = {
      connection: { options: { type: 'mysql' } },
      queryRunner: { isTransactionActive: true },
      findOne: jest.fn(async (entity, options) => {
        const repo = repos[entity.name];
        const result = await repo.findOne(options);
        // The saved parent is now read again under the Source fence.
        return entity === Database && !result && options.where.id
          ? await repos.Database.save.mock.results.at(-1)?.value
          : result;
      }),
      save: (entity, row) => repos[entity.name].save(row),
    };
    (repos.Database.manager.connection as any).transaction = run => run(tx);
  });

  afterEach(() => {
    process.env.FILE_UPLOAD_DIR = prevUploadDir;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('프로비저닝: 샘플 자산 생성 + 대시보드 귀속', async () => {
    repos.Database.findOne.mockResolvedValue(null);
    repos.Database.save.mockImplementation(async e => ({ ...e, id: 11 }));
    repos.Dataset.findOne.mockResolvedValue(null);
    repos.Dataset.save.mockImplementation(async e => ({ ...e, id: 21 }));
    repos.Component.findOne
      .mockResolvedValueOnce({ id: 100, type: 'BOARD_NUMERIC' })
      .mockResolvedValueOnce({ id: 101, type: 'CHART_BAR' });
    repos.Widget.findOne.mockResolvedValue(null);
    repos.Widget.save.mockImplementation(async e => ({
      ...e,
      id: Math.floor(Math.random() * 1000),
    }));
    repos.UserMapping.find.mockResolvedValue([]);
    repos.DashboardShare.save.mockImplementation(async e => ({ ...e, id: 31 }));
    repos.Dashboard.save.mockImplementation(async e => ({ ...e, id: 41 }));
    repos.DashboardWidget.save.mockResolvedValue({});
    repos.UserMapping.save.mockResolvedValue({});

    await service.provisionForUser(7);

    expect(repos.Database.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: '샘플 매출 데이터', type: 'sqlite' }),
    );
    expect(repos.Widget.save).toHaveBeenCalledTimes(2);
    expect(repos.Widget.save).toHaveBeenCalledWith(
      expect.objectContaining({ datasetType: 'DATASET', datasetId: 21 }),
    );
    expect(repos.Dashboard.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: '시작하기: 샘플 매출 대시보드' }),
    );
    expect(repos.UserMapping.save).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: 41, userInfoId: 7 }),
    );
    expect(repos.DashboardWidget.save).toHaveBeenCalledTimes(2);
    // sqlite 파일이 실제로 생성됐는지
    const dbs = fs.readdirSync(uploadDir).filter(f => f.endsWith('.db'));
    expect(dbs.length).toBe(1);
  });

  it('멱등성: 이미 샘플 대시보드가 있는 사용자는 건너뜀', async () => {
    repos.Database.findOne.mockResolvedValue({
      id: 11,
      ownerId: 7,
      catalogActive: true,
      name: '샘플 매출 데이터',
    });
    repos.Dataset.findOne.mockResolvedValue({ id: 21 });
    repos.Component.findOne.mockResolvedValueOnce({ id: 100 }).mockResolvedValueOnce({ id: 101 });
    repos.Widget.findOne.mockResolvedValue({ id: 50 });
    repos.UserMapping.find.mockResolvedValue([{ userInfoId: 7, dashboardId: 41 }]);
    repos.Dashboard.findOne.mockResolvedValue({
      id: 41,
      title: '시작하기: 샘플 매출 대시보드',
      delYn: YesNo.NO,
    });

    await service.provisionForUser(7);

    expect(repos.Database.save).not.toHaveBeenCalled();
    expect(repos.Dashboard.save).not.toHaveBeenCalled();
  });

  it('컴포넌트 시드가 없으면 조용히 실패(로그)하고 예외를 던지지 않음', async () => {
    repos.Database.findOne.mockResolvedValue({
      id: 11,
      ownerId: 7,
      catalogActive: true,
      name: '샘플 매출 데이터',
    });
    repos.Dataset.findOne.mockResolvedValue({ id: 21 });
    repos.Component.findOne.mockResolvedValue(null);
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

    await expect(service.provisionForUser(7)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
