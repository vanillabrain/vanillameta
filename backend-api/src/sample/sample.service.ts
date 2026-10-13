import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import knex from 'knex';
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
import { encryptConnectionConfig } from '../utils/crypto.util';

const SAMPLE_DB_NAME = '샘플 매출 데이터';
const SAMPLE_TABLE = 'sales_data';
const SAMPLE_DATASET_TITLE = '샘플: 지역별 매출';
const SAMPLE_DASHBOARD_TITLE = '시작하기: 샘플 매출 대시보드';
const SAMPLE_WIDGET_TITLES = ['샘플: 이번 달 총 매출', '샘플: 지역별 매출 추이'];

const REGIONS = ['서울', '부산', '대구', '인천', '광주'];
const CATEGORIES = ['전자제품', '의류', '식품', '가구', '도서'];

/**
 * 신규 가입 사용자 온보딩 프로비저닝.
 * - 샘플 sqlite DB/데이터셋/위젯은 사용자별 비공개 자산으로 생성(idempotent)
 * - 대시보드는 가입할 때마다 해당 사용자에게 귀속되도록 생성
 * 모든 실패는 로그만 남기고 가입 플로우를 막지 않는다.
 */
@Injectable()
export class SampleService {
  private readonly logger = new Logger(SampleService.name);

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(Widget) private widgetRepository: Repository<Widget>,
    @InjectRepository(Component) private componentRepository: Repository<Component>,
    @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(DashboardShare) private dashboardShareRepository: Repository<DashboardShare>,
    @InjectRepository(DashboardWidget)
    private dashboardWidgetRepository: Repository<DashboardWidget>,
    @InjectRepository(UserMapping) private userMappingRepository: Repository<UserMapping>,
  ) {}

  async provisionForUser(userInfoId: number): Promise<void> {
    try {
      const dataset = await this.ensureSampleAssets(userInfoId);
      const widgets = await this.ensureSampleWidgets(dataset.id);
      await this.createDashboardForUser(
        userInfoId,
        widgets.map(w => w.id),
      );
      this.logger.log(`sample dashboard provisioned for user ${userInfoId}`);
    } catch (e) {
      this.logger.warn(`sample provisioning skipped for user ${userInfoId}: ${e.message}`);
    }
  }

  private async ensureSampleAssets(userInfoId: number): Promise<Dataset> {
    let database = await this.databaseRepository.findOne({
      where: { name: SAMPLE_DB_NAME, ownerId: userInfoId },
    });
    if (!database) {
      const dbPath = await this.writeSampleSqlite();
      const entity = new Database();
      entity.name = SAMPLE_DB_NAME;
      entity.description = '회원가입 샘플 데이터 — 업로드 없이 바로 대시보드 체험용';
      entity.engine = 'sqlite3';
      entity.type = 'sqlite';
      entity.timezone = 'Asia/Seoul';
      entity.ownerId = userInfoId;
      entity.connectionConfig = encryptConnectionConfig(
        JSON.stringify({
          client: 'sqlite3',
          connection: { filename: dbPath },
          useNullAsDefault: true,
        }),
      );
      database = await this.databaseRepository.save(entity);
    }

    let dataset = await this.datasetRepository.findOne({
      where: { title: SAMPLE_DATASET_TITLE, databaseId: database.id },
    });
    if (!dataset) {
      dataset = await this.datasetRepository.save({
        title: SAMPLE_DATASET_TITLE,
        databaseId: database.id,
        query: `SELECT region, category, SUM(amount) AS total_amount, SUM(qty) AS total_qty FROM ${SAMPLE_TABLE} GROUP BY region, category`,
      });
    }
    return dataset;
  }

  private async writeSampleSqlite(): Promise<string> {
    const uploadDir = process.env.FILE_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const dbPath = path.join(uploadDir, `sample-${uuidv4()}.db`);
    const db = knex({
      client: 'sqlite3',
      connection: { filename: dbPath },
      useNullAsDefault: true,
    });
    try {
      await db.schema.createTable(SAMPLE_TABLE, t => {
        t.text('sale_date');
        t.text('region');
        t.text('category');
        t.text('product');
        t.float('amount');
        t.float('qty');
      });
      const rows: Record<string, unknown>[] = [];
      for (let m = 1; m <= 12; m++) {
        REGIONS.forEach((region, ri) => {
          CATEGORIES.forEach((category, ci) => {
            const seasonal = 1 + 0.3 * Math.sin((m / 12) * Math.PI * 2 + ri);
            const amount = Math.round((800 + ci * 350 + ri * 120) * seasonal * (1 + m * 0.02));
            rows.push({
              sale_date: `2025-${String(m).padStart(2, '0')}-15`,
              region,
              category,
              product: `${category}-${ri + 1}`,
              amount,
              qty: Math.round(amount / 120) + ((m + ri + ci) % 7),
            });
          });
        });
      }
      for (let i = 0; i < rows.length; i += 500) {
        await db(SAMPLE_TABLE).insert(rows.slice(i, i + 500));
      }
    } finally {
      await db.destroy();
    }
    return dbPath;
  }

  private async ensureSampleWidgets(datasetId: number): Promise<Widget[]> {
    const [numericComp, barComp] = await Promise.all([
      this.componentRepository.findOne({ where: { type: 'BOARD_NUMERIC' } }),
      this.componentRepository.findOne({ where: { type: 'CHART_BAR' } }),
    ]);
    if (!numericComp || !barComp) {
      throw new Error('component seed missing (run npm run seed)');
    }

    const specs: { title: string; componentId: number; option: Record<string, unknown> }[] = [
      {
        title: SAMPLE_WIDGET_TITLES[0],
        componentId: numericComp.id,
        option: {
          header: { title: '총 매출 (샘플)', fontSize: 20, color: '#4A4A4A', titleHidden: false },
          content: { field: 'total_amount', aggregation: 'sum', fontSize: 50, color: '#4A4A4A' },
        },
      },
      {
        title: SAMPLE_WIDGET_TITLES[1],
        componentId: barComp.id,
        option: {
          xField: 'region',
          series: [{ field: 'total_amount', aggregation: 'sum', color: '#6aa7eb' }],
          label: true,
          mark: true,
          legendPosition: 'top',
        },
      },
    ];

    const widgets: Widget[] = [];
    for (const spec of specs) {
      let widget = await this.widgetRepository.findOne({
        where: {
          datasetId,
          datasetType: DatasetType.DATASET,
          componentId: spec.componentId,
          delYn: YesNo.NO,
        },
      });
      if (!widget) {
        widget = await this.widgetRepository.save({
          title: spec.title,
          description: '온보딩 샘플 위젯',
          componentId: spec.componentId,
          datasetType: DatasetType.DATASET,
          datasetId,
          option: JSON.stringify(spec.option),
          delYn: YesNo.NO,
        });
      }
      widgets.push(widget);
    }
    return widgets;
  }

  private async createDashboardForUser(userInfoId: number, widgetIds: number[]): Promise<void> {
    // 같은 사용자에게 중복 생성 방지 — 해당 사용자의 매핑 전부 확인
    const mappings = await this.userMappingRepository.find({ where: { userInfoId } });
    if (mappings.length) {
      const dup = await this.dashboardRepository.findOne({
        where: { title: SAMPLE_DASHBOARD_TITLE, delYn: YesNo.NO },
      });
      if (dup && mappings.some(m => m.dashboardId === dup.id)) return;
    }

    const share = await this.dashboardShareRepository.save({ uuid: uuidv4() });
    const layout = widgetIds.map((id, i) => ({ i: id, x: i * 6, y: 0, w: 6, h: 4 }));
    const dashboard = await this.dashboardRepository.save({
      title: SAMPLE_DASHBOARD_TITLE,
      layout: JSON.stringify(layout),
      delYn: YesNo.NO,
      shareId: share.id,
    });
    await this.userMappingRepository.save({
      dashboardId: dashboard.id,
      userInfoId,
      createdAt: new Date(),
    });
    for (const widgetId of widgetIds) {
      await this.dashboardWidgetRepository.save({ dashboardId: dashboard.id, widgetId });
    }
  }
}
