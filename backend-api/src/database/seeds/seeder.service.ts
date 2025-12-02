import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Component } from '../../component/entities/component.entity';
import { DatabaseType } from '../entities/database_type.entity';
import { Database } from '../entities/database.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { TableQuery } from '../../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { Template } from '../../template/entities/template.entity';
import { TemplateItem } from '../../template/entities/template-item.entity';
import { User } from '../../user/entities/user.entity';
import { YesNo } from '../../common/enum/yn.enum';
import { DatasetType } from '../../common/enum/dataset-type.enum';

/**
 * SeederService - 앱 시작 시 SQLite 데이터베이스에 초기 데이터를 자동으로 삽입합니다.
 * local 환경(SQLite)에서만 동작하며, 데이터가 이미 있으면 seed를 실행하지 않습니다.
 */
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // local 환경(SQLite)에서만 자동 seed 실행
    if (nodeEnv !== 'local') {
      this.logger.log('자동 seed는 local 환경에서만 실행됩니다.');
      return;
    }

    try {
      await this.seedIfEmpty();
    } catch (error) {
      this.logger.error('Seed 실행 중 오류 발생:', error);
    }
  }

  /**
   * 데이터가 비어있으면 seed를 실행합니다.
   */
  private async seedIfEmpty(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const userCount = await userRepository.count();

    if (userCount > 0) {
      this.logger.log('데이터가 이미 존재합니다. Seed를 건너뜁니다.');
      return;
    }

    this.logger.log('초기 데이터 seed 시작...');
    await this.runSeed();
    this.logger.log('초기 데이터 seed 완료!');
  }

  /**
   * 초기 데이터를 삽입합니다.
   */
  private async runSeed(): Promise<void> {
    // Component 데이터 삽입
    await this.seedComponents();

    // DatabaseType 데이터 삽입
    await this.seedDatabaseTypes();

    // Database(연결정보) 데이터 삽입
    await this.seedDatabases();

    // 샘플 데이터 테이블 생성 (sqlite.db에 sample_data 테이블)
    await this.seedSampleDataTable();

    // Dataset 데이터 삽입
    await this.seedDatasets();

    // TableQuery 데이터 삽입
    await this.seedTableQueries();

    // Template 데이터 삽입
    await this.seedTemplates();

    // TemplateItem 데이터 삽입
    await this.seedTemplateItems();

    // User 데이터 삽입
    await this.seedUsers();

    // Widget 데이터 삽입
    await this.seedWidgets();
  }

  /**
   * sqlite.db에 sample_data 테이블을 생성하고 샘플 데이터를 삽입합니다.
   */
  private async seedSampleDataTable(): Promise<void> {
    // sqlite.db에 직접 sample_data 테이블 생성
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sample_data (
        id INTEGER PRIMARY KEY,
        category TEXT,
        name TEXT,
        value REAL,
        date TEXT
      )
    `);

    // 샘플 데이터 삽입
    const sampleData = [
      { id: 1, category: '전자제품', name: '스마트폰', value: 1200000, date: '2024-01-15' },
      { id: 2, category: '전자제품', name: '노트북', value: 1800000, date: '2024-01-20' },
      { id: 3, category: '전자제품', name: '태블릿', value: 800000, date: '2024-02-01' },
      { id: 4, category: '가전', name: '냉장고', value: 1500000, date: '2024-02-10' },
      { id: 5, category: '가전', name: '세탁기', value: 900000, date: '2024-02-15' },
      { id: 6, category: '가전', name: '에어컨', value: 1100000, date: '2024-03-01' },
      { id: 7, category: '의류', name: '자켓', value: 150000, date: '2024-03-10' },
      { id: 8, category: '의류', name: '청바지', value: 80000, date: '2024-03-15' },
      { id: 9, category: '의류', name: '셔츠', value: 60000, date: '2024-04-01' },
      { id: 10, category: '식품', name: '과일', value: 30000, date: '2024-04-10' },
      { id: 11, category: '식품', name: '육류', value: 50000, date: '2024-04-15' },
      { id: 12, category: '식품', name: '유제품', value: 25000, date: '2024-05-01' },
      { id: 13, category: '전자제품', name: '이어폰', value: 200000, date: '2024-05-10' },
      { id: 14, category: '전자제품', name: '스마트워치', value: 400000, date: '2024-05-15' },
      { id: 15, category: '가전', name: '청소기', value: 500000, date: '2024-06-01' },
    ];

    for (const data of sampleData) {
      await this.dataSource.query(`
        INSERT OR IGNORE INTO sample_data (id, category, name, value, date)
        VALUES (?, ?, ?, ?, ?)
      `, [data.id, data.category, data.name, data.value, data.date]);
    }
  }

  private async seedComponents(): Promise<void> {
    const componentData = [
      { id: 1, type: "CHART_LINE", title: "선형 차트", description: "Line Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}", icon: "icon/ct-line.svg", seq: 3, useYn: YesNo.YES },
      { id: 2, type: "CHART_AREA", title: "영역형 차트", description: "Area Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}", icon: "icon/ct-area.svg", seq: 4, useYn: YesNo.YES },
      { id: 3, type: "CHART_BAR", title: "세로 막대형 차트", description: "Bar Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}", icon: "icon/ct-bar.svg", seq: 5, useYn: YesNo.YES },
      { id: 4, type: "CHART_COLUMN", title: "가로 막대형 차트", description: "Column Chart", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}", icon: "icon/ct-column.svg", seq: 6, useYn: YesNo.YES },
      { id: 5, type: "MIXED_CHART_LINE_BAR", title: "선형과 세로 막대형 복합 차트", description: "Mixed Line and Bar Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\",\"type\":\"line\"},{\"color\":\"#47a8ea\",\"aggregation\":\"sum\",\"type\":\"bar\"}],\"label\":true}", icon: "icon/ct-mixed-line-bar.svg", seq: 7, useYn: YesNo.YES },
      { id: 6, type: "CHART_PIE", title: "원형 차트", description: "Pie Chart", category: "SQUARE", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\"}}", icon: "icon/ct-pie.svg", seq: 13, useYn: YesNo.YES },
      { id: 7, type: "CHART_NIGHTINGALE", title: "나이팅게일 차트", description: "Nightingale Chart", category: "SQUARE", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"20%\",\"75%\"]}}", icon: "icon/ct-nightingale.svg", seq: 15, useYn: YesNo.YES },
      { id: 8, type: "CHART_BUBBLE", title: "거품형 차트", description: "Bubble Chart", category: "SQUARE", option: "{\"series\":[{\"title\":\"이름 1\",\"color\":\"#6aa7eb\"}]}", icon: "icon/ct-bubble.svg", seq: 18, useYn: YesNo.YES },
      { id: 9, type: "CHART_RADAR", title: "방사형 차트", description: "Radar Chart", category: "SQUARE", option: "{\"series\":[{\"color\":\"#2870c5\",\"aggregation\":\"sum\"}],\"label\":true}", icon: "icon/ct-radar.svg", seq: 16, useYn: YesNo.YES },
      { id: 10, type: "CHART_SCATTER", title: "분산형 차트", description: "Scatter Chart", category: "SQUARE", option: "{\"series\":[{\"title\":\"이름 1\",\"symbolSize\":\"20\",\"color\":\"#6aa7eb\"}]}", icon: "icon/ct-scatter.svg", seq: 17, useYn: YesNo.YES },
      { id: 11, type: "CHART_DONUT", title: "도넛형 차트", description: "Donut Chart", category: "SQUARE", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"30%\",\"75%\"]}}", icon: "icon/ct-donut.svg", seq: 14, useYn: YesNo.YES },
      { id: 12, type: "BOARD_NUMERIC", title: "숫자판", description: "Score Board", category: "SCORE", option: "{\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score.svg", seq: 1, useYn: YesNo.YES },
      { id: 13, type: "BOARD_TABLE", title: "표", description: "Data Grid", category: "TABLE", option: "{\"columns\":[]}", icon: "icon/ct-grid.svg", seq: 2, useYn: YesNo.YES },
      { id: 14, type: "CHART_STACKED_LINE", title: "누적 선형 차트", description: "Stacked Line Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}", icon: "icon/ct-stacked-line.svg", seq: 8, useYn: YesNo.YES },
      { id: 15, type: "CHART_STACKED_AREA", title: "누적 영역형 차트", description: "Stacked Area Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}", icon: "icon/ct-stacked-area.svg", seq: 9, useYn: YesNo.YES },
      { id: 16, type: "CHART_STACKED_COLUMN", title: "누적 가로 막대형 차트", description: "Stacked Column Chart", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}", icon: "icon/ct-stacked-column.svg", seq: 10, useYn: YesNo.YES },
      { id: 17, type: "CHART_STACKED_BAR", title: "누적 세로 막대형 차트", description: "Stacked Bar Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}", icon: "icon/ct-stacked-bar.svg", seq: 11, useYn: YesNo.YES },
      { id: 19, type: "CHART_TREEMAP", title: "트리맵 차트", description: "Treemap Chart", category: "SQUARE", option: "{\"series\":{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"},\"label\":true}", icon: "icon/ct-treemap.svg", seq: 19, useYn: YesNo.YES },
      { id: 20, type: "CHART_CANDLESTICK", title: "캔들스틱 차트", description: "Candlestick Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#FA5A5A\",\"aggregation\":\"sum\"},{\"color\":\"#2870C4\",\"aggregation\":\"sum\"},{\"color\":\"#E03B3B\",\"aggregation\":\"sum\"},{\"color\":\"#215DA3\",\"aggregation\":\"sum\"}]}", icon: "icon/ct-candlestick.svg", seq: 22, useYn: YesNo.YES },
      { id: 21, type: "CHART_GAUGE", title: "계기판 차트", description: "Gauge Chart", category: "SQUARE", option: "{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}", icon: "icon/ct-gauge.svg", seq: 23, useYn: YesNo.YES },
      { id: 22, type: "CHART_SUNBURST", title: "선버스트 차트", description: "Sunburst Chart", category: "SQUARE", option: "{\"series\":{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"},\"label\":true}", icon: "icon/ct-sunburst.svg", seq: 20, useYn: YesNo.YES },
      { id: 23, type: "CHART_HEATMAP", title: "히트맵 차트", description: "Heatmap Chart", category: "SQUARE", option: "{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"}", icon: "icon/ct-heatmap.svg", seq: 21, useYn: YesNo.YES },
      { id: 24, type: "CHART_FUNNEL", title: "깔때기형 차트", description: "Funnel Chart", category: "VERTICAL", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\"}}", icon: "icon/ct-funnel.svg", seq: 24, useYn: YesNo.YES },
      { id: 25, type: "CHART_3D_BAR", title: "3D 막대형 차트", description: "3D Bar Chart", category: "SQUARE", option: "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"]}", icon: "icon/ct-3d-bar.svg", seq: 28, useYn: YesNo.YES },
      { id: 26, type: "CHART_3D_LINE", title: "3D 선형 차트", description: "3D Line Chart", category: "SQUARE", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}]}", icon: "icon/ct-3d-line.svg", seq: 27, useYn: YesNo.YES },
      { id: 27, type: "CHART_3D_SCATTER", title: "3D 분산형 차트", description: "3D Scatter Chart", category: "SQUARE", option: "{\"series\":[{\"title\":\"이름 1\",\"symbolSize\":\"20\",\"color\":\"#6aa7eb\"}]}", icon: "icon/ct-3d-scatter.svg", seq: 29, useYn: YesNo.YES },
      { id: 28, type: "CHART_3D_BUBBLE", title: "3D 거품형 차트", description: "3D Bubble Chart", category: "SQUARE", option: "{\"series\":[{\"title\":\"이름 1\",\"color\":\"#6aa7eb\"}]}", icon: "icon/ct-3d-bubble.svg", seq: 30, useYn: YesNo.YES },
      { id: 29, type: "CHART_WATERFALL_BAR", title: "폭포수 세로 차트", description: "Waterfall Bar Chart", category: "VERTICAL", option: "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#6aa7eb\",\"#fa5a5a\"],\"mark\":true}", icon: "", seq: null, useYn: YesNo.YES },
      { id: 30, type: "CHART_WATERFALL_COLUMN", title: "폭포수 가로 차트", description: "Waterfall Column Chart", category: "HORIZONTAL", option: "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#6aa7eb\",\"#fa5a5a\"],\"mark\":true}", icon: "", seq: null, useYn: YesNo.YES },
      { id: 31, type: "CHART_POLAR_BAR", title: "극좌표 막대형 차트", description: "Polar Bar Chart", category: "SQUARE", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"radius\":[\"10%\",\"75%\"]}", icon: "icon/ct-polar-bar.svg", seq: 25, useYn: YesNo.YES },
      { id: 32, type: "MIXED_CHART_LINE_PIE", title: "선형과 원형 복합 차트", description: "Mixed Line and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}", icon: "icon/ct-pie-line.svg", seq: 31, useYn: YesNo.YES },
      { id: 33, type: "CHART_POLAR_STACKED_BAR", title: "극좌표 누적 막대형 차트", description: "Polar Stacked Bar Chart", category: "SQUARE", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"radius\":[\"10%\",\"75%\"]}", icon: "icon/ct-polar-stacked-bar.svg", seq: 26, useYn: YesNo.YES },
      { id: 34, type: "MIXED_CHART_AREA_PIE", title: "영역형과 원형 복합 차트", description: "Mixed Area and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}", icon: "icon/ct-pie-area.svg", seq: 32, useYn: YesNo.YES },
      { id: 35, type: "MIXED_CHART_BAR_PIE", title: "세로 막대형과 원형 복합 차트", description: "Mixed Bar and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}", icon: "icon/ct-pie-bar.svg", seq: 33, useYn: YesNo.YES },
      { id: 36, type: "MIXED_CHART_COLUMN_PIE", title: "가로 막대형과 원형 복합 차트", description: "Mixed Column and Pie Chart", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}", icon: "icon/ct-pie-column.svg", seq: 34, useYn: YesNo.YES },
      { id: 37, type: "MIXED_CHART_STACKED_BAR_PIE", title: "누적 세로 막대형과 원형 복합 차트", description: "Mixed Stacked-Bar and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}", icon: "icon/ct-pie-stacked-bar.svg", seq: 35, useYn: YesNo.YES },
      { id: 38, type: "MIXED_CHART_STACKED_COLUMN_PIE", title: "누적 가로 막대형과 원형 복합 차트", description: "Mixed Stacked-Column and Pie Chart", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}", icon: "icon/ct-pie-stacked-column.svg", seq: 36, useYn: YesNo.YES },
      { id: 39, type: "MIXED_CHART_STACKED_LINE_PIE", title: "누적 선형과 원형 복합 차트", description: "Mixed Stacked-Line and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}", icon: "icon/ct-pie-stacked-line.svg", seq: 37, useYn: YesNo.YES },
      { id: 40, type: "MIXED_CHART_STACKED_AREA_PIE", title: "누적 영역형과 원형 복합 차트", description: "Mixed Stacked-Area and Pie Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}", icon: "icon/ct-pie-stacked-area.svg", seq: 38, useYn: YesNo.YES },
      { id: 41, type: "MIXED_CHART_DONUT_PIE", title: "도넛형과 원형 복합 차트", description: "Mixed Donut and Pie Chart", category: "SQUARE", option: "{\"series\":{\"aggregation\":\"sum\",\"radius\":[\"45%\",\"60%\"],\"label\":\"{b}\"},\"pie\":{\"radius\":\"30%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"color\":[]}", icon: "icon/ct-pie-donut.svg", seq: 39, useYn: YesNo.YES },
      { id: 42, type: "MIXED_CHART_NIGHTINGALE_PIE", title: "나이팅게일과 원형 복합 차트", description: "Mixed Nightingale and Pie Chart", category: "SQUARE", option: "{\"series\":{\"aggregation\":\"sum\",\"radius\":[\"45%\",\"60%\"],\"label\":\"{b}\"},\"pie\":{\"radius\":\"30%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"color\":[]}", icon: "icon/ct-pie-nightingale.svg", seq: 40, useYn: YesNo.YES },
      { id: 43, type: "MIXED_CHART_LINE_STACKED_BAR", title: "선형과 누적 세로 막대형 복합 차트", description: "Mixed Line and Stacked-Bar Chart", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\",\"type\":\"line\"},{\"color\":\"#47a8ea\",\"aggregation\":\"sum\",\"type\":\"bar\"}],\"label\":true}", icon: "icon/ct-mixed-line-stacked-bar.svg", seq: 12, useYn: YesNo.YES },
      { id: 44, type: "MIXED_CHART_LINE_BOARD_NUMERIC", title: "선형 차트와 숫자 보드", description: "Line Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-line.svg", seq: 41, useYn: YesNo.YES },
      { id: 45, type: "MIXED_CHART_AREA_BOARD_NUMERIC", title: "영역형 차트와 숫자 보드", description: "Area Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-area.svg", seq: 42, useYn: YesNo.YES },
      { id: 46, type: "MIXED_CHART_BAR_BOARD_NUMERIC", title: "세로 막대형 차트와 숫자 보드", description: "Bar Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-bar.svg", seq: 43, useYn: YesNo.YES },
      { id: 47, type: "MIXED_CHART_COLUMN_BOARD_NUMERIC", title: "가로 막대형 차트와 숫자 보드", description: "Column Chart and Score Board", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-column.svg", seq: 44, useYn: YesNo.YES },
      { id: 48, type: "MIXED_CHART_STACKED_LINE_BOARD_NUMERIC", title: "누적 선형 차트와 숫자 보드", description: "Stacked Line Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-stacked-line.svg", seq: 45, useYn: YesNo.YES },
      { id: 49, type: "MIXED_CHART_STACKED_AREA_BOARD_NUMERIC", title: "누적 영역형 차트와 숫자 보드", description: "Stacked Area Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-stacked-area.svg", seq: 46, useYn: YesNo.YES },
      { id: 50, type: "MIXED_CHART_STACKED_BAR_BOARD_NUMERIC", title: "누적 세로 막대형 차트와 숫자 보드", description: "Stacked Bar Chart and Score Board", category: "HORIZONTAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-stacked-bar.svg", seq: 47, useYn: YesNo.YES },
      { id: 51, type: "MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC", title: "누적 가로 막대형 차트와 숫자 보드", description: "Stacked Column Chart and Score Board", category: "VERTICAL", option: "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-stacked-column.svg", seq: 48, useYn: YesNo.YES },
      { id: 52, type: "MIXED_CHART_DONUT_BOARD_NUMERIC", title: "도넛형 차트와 숫자 보드", description: "Donut Chart and Score Board", category: "SQUARE", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"40%\",\"75%\"]},\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-donut.svg", seq: 49, useYn: YesNo.YES },
      { id: 53, type: "MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC", title: "나이팅게일 차트와 숫자 보드", description: "Nightingale Chart and Score Board", category: "SQUARE", option: "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"40%\",\"75%\"]},\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}", icon: "icon/ct-score-nightingale.svg", seq: 50, useYn: YesNo.YES },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Component)
      .values(componentData)
      .execute();
  }

  private async seedDatabaseTypes(): Promise<void> {
    const databaseTypeData = [
      { id: 1, engine: "mysql2", type: "mysql", title: "MySQL", seq: 1, useYn: YesNo.YES },
      { id: 2, engine: "mysql2", type: "maria", title: "MariaDB", seq: 2, useYn: YesNo.YES },
      { id: 3, engine: "pg", type: "postgres", title: "PostgreSQL", seq: 3, useYn: YesNo.YES },
      { id: 4, engine: "oracledb", type: "oracle", title: "Oracle", seq: 4, useYn: YesNo.YES },
      { id: 5, engine: "db2", type: "db2", title: "DB2", seq: 5, useYn: YesNo.NO },
      { id: 6, engine: "pg", type: "redshift", title: "Amazon Redshift", seq: 6, useYn: YesNo.YES },
      { id: 7, engine: "bigquery", type: "bigquery", title: "Google Cloud BigQuery", seq: 7, useYn: YesNo.YES },
      { id: 8, engine: "sqlite3", type: "sqlite", title: "SQLite", seq: 8, useYn: YesNo.YES },
      { id: 9, engine: "mssql", type: "mssql", title: "MSSQL", seq: 9, useYn: YesNo.YES },
      { id: 10, engine: "snowflake", type: "snowflake", title: "Snowflake", seq: 10, useYn: YesNo.YES },
      { id: 11, engine: "mysql2", type: "aurora", title: "Amazon Aurora", seq: 11, useYn: YesNo.NO },
      { id: 12, engine: "cockroachdb", type: "cockroachDB", title: "CockroachDB", seq: 12, useYn: YesNo.YES },
      { id: 13, engine: "pg", type: "postGIS", title: "postGIS", seq: 13, useYn: YesNo.NO },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(DatabaseType)
      .values(databaseTypeData)
      .execute();
  }

  private async seedTemplates(): Promise<void> {
    const templateData = [
      { id: 7, title: "세로 2단 구성", description: "차트를 양쪽으로 균등하게 배열하여 비교 시 사용", useYn: YesNo.YES },
      { id: 8, title: "상하단 구성", description: "상하 구조로 데이터의 연속성으로 비교 분석 시 사용", useYn: YesNo.YES },
      { id: 9, title: "2단 구성과 하단 상세 데이터", description: "주요 차트를 상단에 2가지 배열하여 비교 후 하단에 상세데이터 확인 필요 시 사용", useYn: YesNo.YES },
      { id: 10, title: "차트의 크기 활용한 2단 구성", description: "좌측에 상세 차트를 확인 후 우측에 요약 차트를 확인할 경우 사용", useYn: YesNo.YES },
      { id: 11, title: "3단 구성과 상세 데이터", description: "3가지의 차트로 데이터를 확인 후 하단 영역에 상세 데이터를 배열 할 경우 사용", useYn: YesNo.YES },
      { id: 12, title: "3단 구성과 하단 2단 구성 복합 레이아웃", description: "상단 3가지 차트 나열 후 하단 비교를 원하는 차트를 양쪽 배열 시 사용", useYn: YesNo.YES },
      { id: 13, title: "중앙 주요 차트와 좌우 상세 차트", description: "주요 차트를 중앙에 노출하여 집중도를 높이고 좌우로 상세 차트를 배열 시 사용", useYn: YesNo.YES },
      { id: 14, title: "4단 상단 구성과 하단 2가지 차트", description: "비교 가능한 4가지의 차트 배열 후 하단 영역을 크게 활용하여 차트 배열 시 사용", useYn: YesNo.YES },
      { id: 15, title: "4단 상단 구성과 하단 3가지 차트", description: "4가지의 차트 배열 후 하단 3가지 차트 배열로 상세 차트를 같이 노출 원할 때 사용", useYn: YesNo.YES },
      { id: 16, title: "4단구성 상하단", description: "한 화면 다양한 차트를 균일한 크기로 노출할 때 사용", useYn: YesNo.YES },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Template)
      .values(templateData)
      .execute();
  }

  private async seedTemplateItems(): Promise<void> {
    const templateItemData = [
      { id: 17, templateId: 8, x: 0, y: 0, width: 12, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 18, templateId: 8, x: 0, y: 4, width: 12, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 19, templateId: 9, x: 0, y: 0, width: 6, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 20, templateId: 9, x: 6, y: 0, width: 6, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 21, templateId: 9, x: 0, y: 4, width: 12, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 22, templateId: 10, x: 0, y: 0, width: 8, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 23, templateId: 10, x: 8, y: 0, width: 4, height: 4, recommendCategory: "SQUARE", recommendType: "" },
      { id: 24, templateId: 10, x: 0, y: 4, width: 8, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 25, templateId: 10, x: 8, y: 4, width: 4, height: 4, recommendCategory: "SQUARE", recommendType: "" },
      { id: 26, templateId: 11, x: 0, y: 0, width: 4, height: 4, recommendCategory: "SQUARE", recommendType: "" },
      { id: 27, templateId: 11, x: 4, y: 0, width: 4, height: 4, recommendCategory: "SQUARE", recommendType: "" },
      { id: 28, templateId: 11, x: 8, y: 0, width: 4, height: 4, recommendCategory: "SQUARE", recommendType: "" },
      { id: 29, templateId: 11, x: 0, y: 4, width: 12, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 30, templateId: 12, x: 0, y: 0, width: 4, height: 3, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 31, templateId: 12, x: 4, y: 0, width: 4, height: 3, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 32, templateId: 12, x: 8, y: 0, width: 4, height: 3, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 33, templateId: 12, x: 0, y: 3, width: 6, height: 5, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 34, templateId: 12, x: 6, y: 3, width: 6, height: 5, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 35, templateId: 13, x: 0, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 36, templateId: 13, x: 3, y: 0, width: 6, height: 8, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 37, templateId: 13, x: 9, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 38, templateId: 13, x: 0, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 39, templateId: 13, x: 9, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 40, templateId: 14, x: 0, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 41, templateId: 14, x: 3, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 42, templateId: 14, x: 6, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 43, templateId: 14, x: 9, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 44, templateId: 14, x: 0, y: 4, width: 6, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 45, templateId: 14, x: 6, y: 4, width: 6, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 46, templateId: 15, x: 0, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 47, templateId: 15, x: 3, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 48, templateId: 15, x: 6, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 49, templateId: 15, x: 9, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 50, templateId: 15, x: 0, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 51, templateId: 15, x: 3, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 52, templateId: 15, x: 6, y: 4, width: 6, height: 4, recommendCategory: "HORIZONTAL", recommendType: "" },
      { id: 53, templateId: 16, x: 0, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 54, templateId: 16, x: 3, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 55, templateId: 16, x: 6, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 56, templateId: 16, x: 9, y: 0, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 57, templateId: 16, x: 0, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 58, templateId: 16, x: 3, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 59, templateId: 16, x: 6, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 60, templateId: 16, x: 9, y: 4, width: 3, height: 4, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 63, templateId: 7, x: 0, y: 0, width: 6, height: 8, recommendCategory: "VERTICAL", recommendType: "" },
      { id: 64, templateId: 7, x: 6, y: 0, width: 6, height: 8, recommendCategory: "VERTICAL", recommendType: "" },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(TemplateItem)
      .values(templateItemData)
      .execute();
  }

  private async seedUsers(): Promise<void> {
    const userData = [
      {
        id: 1,
        email: "guest@gmail.com",
        password: "0258acb251701900c2abcde987033e032838df1eb39f10bfb9e9f6398866b13acb104f00485b92b11db90544744280626980c3888b9ba98ea8f319f9747d051e",
        userId: "guest",
      },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(userData)
      .execute();
  }

  /**
   * 샘플 Database 연결정보를 삽입합니다.
   * 모든 databaseId가 동일한 sqlite.db를 참조하도록 설정
   */
  private async seedDatabases(): Promise<void> {
    const databaseData = [
      { id: 1, name: "샘플 SQLite DB", description: "테스트용 SQLite 데이터베이스", engine: "sqlite3", type: "sqlite", connectionConfig: JSON.stringify({ client: "sqlite3", connection: { filename: "sqlite.db" }, useNullAsDefault: true }), timezone: "Asia/Seoul" },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Database)
      .values(databaseData)
      .execute();
  }

  /**
   * Dataset 데이터를 삽입합니다.
   * datasetType: DATASET인 위젯들이 참조
   */
  private async seedDatasets(): Promise<void> {
    const datasetData = [
      { id: 25, databaseId: 1, title: "샘플 데이터셋 25", query: "SELECT * FROM sample_data" },
      { id: 26, databaseId: 1, title: "샘플 데이터셋 26", query: "SELECT * FROM sample_data" },
      { id: 27, databaseId: 1, title: "샘플 데이터셋 27", query: "SELECT * FROM sample_data" },
      { id: 28, databaseId: 1, title: "샘플 데이터셋 28", query: "SELECT * FROM sample_data" },
      { id: 29, databaseId: 1, title: "샘플 데이터셋 29", query: "SELECT * FROM sample_data" },
      { id: 30, databaseId: 1, title: "샘플 데이터셋 30", query: "SELECT * FROM sample_data" },
      { id: 31, databaseId: 1, title: "샘플 데이터셋 31", query: "SELECT * FROM sample_data" },
      { id: 37, databaseId: 1, title: "샘플 데이터셋 37", query: "SELECT * FROM sample_data" },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Dataset)
      .values(datasetData)
      .execute();
  }

  /**
   * TableQuery 데이터를 삽입합니다.
   * datasetType: TABLE인 위젯들이 참조
   */
  private async seedTableQueries(): Promise<void> {
    // 모든 TableQuery가 databaseId: 1 (sqlite.db)을 바라보도록 설정
    const tableQueryData = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      databaseId: 1,
      query: "SELECT * FROM sample_data",
    }));

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(TableQuery)
      .values(tableQueryData)
      .execute();
  }

  /**
   * Widget 데이터를 삽입합니다.
   * widgetTestOption.json 테스트 데이터 기반
   */
  private async seedWidgets(): Promise<void> {
    // databaseId 매핑: 기존 외부 DB ID -> 새 SQLite ID
    // 83->1, 88->2, 108->3, 113->4, 114->5, 118->6, 119->7, 137->8, 138->9, 139->10
    const widgetData = [
      // 001~010: 기본 차트들
      { id: 1, title: "001 숫자판", description: "Score Board", componentId: 12, datasetType: DatasetType.DATASET, datasetId: 27, option: JSON.stringify({ header: { title: "평균 급여", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "avg", fontSize: 50, color: "#4A4A4A", field: "annualSalary", numForm: true, suffix: "원" } }) },
      { id: 2, title: "002 표", description: "Data Grid", componentId: 13, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ columns: [{ name: "yearsmarried", header: "Year Merried", align: "right", sortable: true }, { name: "age", header: "Age", align: "right", sortable: true }, { name: "gender", header: "Gender", align: "right", sortable: true }] }) },
      { id: 3, title: "003 선형 차트", description: "Line Chart", componentId: 1, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "education" }, { field: "wage", color: "#85c7fc", aggregation: "sum" }, { field: "experience", color: "#94c983", aggregation: "sum" }, { field: "age", color: "#c1d96a", aggregation: "sum" }], mark: true, xField: "education", legendPosition: "top" }) },
      { id: 4, title: "004 영역형 차트", description: "Area Chart", componentId: 2, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "education" }, { field: "wage", color: "#85c7fc", aggregation: "sum" }, { field: "experience", color: "#94c983", aggregation: "sum" }, { field: "age", color: "#c1d96a", aggregation: "sum" }], mark: true, xField: "education", legendPosition: "top" }) },
      { id: 5, title: "005 세로 막대형 차트", description: "Bar Chart", componentId: 3, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "education" }, { field: "wage", color: "#85c7fc", aggregation: "sum" }, { field: "experience", color: "#94c983", aggregation: "sum" }, { field: "age", color: "#c1d96a", aggregation: "sum" }], mark: true, xField: "education", legendPosition: "top" }) },
      { id: 6, title: "006 가로 막대형 차트", description: "Column Chart", componentId: 4, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "education" }, { field: "wage", color: "#85c7fc", aggregation: "sum" }, { field: "experience", color: "#94c983", aggregation: "sum" }, { field: "age", color: "#c1d96a", aggregation: "sum" }], mark: true, yField: "education", legendPosition: "top" }) },
      { id: 7, title: "007 선형과 세로 막대형 복합 차트", description: "Mixed Line and Bar Chart", componentId: 5, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "avg", type: "line", field: "education" }, { color: "#47a8ea", aggregation: "avg", type: "bar", field: "occupation" }, { field: "yearsmarried", color: "#94c983", aggregation: "avg", type: "bar" }], label: true, xField: "age", legendPosition: "left", mark: true }) },
      { id: 8, title: "008 누적 선형 차트", description: "Stacked Line Chart", componentId: 14, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }, { field: "robbery", color: "#85c7fc", aggregation: "sum" }, { field: "murder", color: "#94c983", aggregation: "sum" }], label: "", xField: "year", mark: "", legendPosition: "left" }) },
      { id: 9, title: "009 누적 영역형 차트", description: "Stacked Area Chart", componentId: 15, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }, { field: "robbery", color: "#85c7fc", aggregation: "sum" }, { field: "murder", color: "#94c983", aggregation: "sum" }], label: "", xField: "year", mark: "", legendPosition: "left" }) },
      { id: 10, title: "010 누적 가로 막대형 차트", description: "Stacked Column Chart", componentId: 16, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }, { field: "robbery", color: "#85c7fc", aggregation: "sum" }, { field: "murder", color: "#94c983", aggregation: "sum" }], label: "", yField: "year", mark: "", legendPosition: "left" }) },
      // 011~020
      { id: 11, title: "011 누적 세로 막대형 차트", description: "Stacked Bar Chart", componentId: 17, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }, { field: "robbery", color: "#85c7fc", aggregation: "sum" }, { field: "murder", color: "#94c983", aggregation: "sum" }], label: "", xField: "year", mark: "", legendPosition: "left" }) },
      { id: 12, title: "012 선형과 누적 세로 막대형 복합 차트", description: "Mixed Line and Stacked-Bar Chart", componentId: 43, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", type: "bar", field: "murder" }, { color: "#47a8ea", aggregation: "sum", type: "bar", field: "robbery" }, { field: "violent", color: "#94c983", aggregation: "sum", type: "bar" }, { field: "prisoners", color: "#d0021b", aggregation: "sum", type: "line" }], label: "", xField: "year", mark: true, legendPosition: "top" }) },
      { id: 13, title: "013 원형 차트", description: "Pie Chart", componentId: 6, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", name: "occupation", field: "age" }, legendPosition: "left" }) },
      { id: 14, title: "014 도넛형 차트", description: "Donut Chart", componentId: 11, datasetType: DatasetType.DATASET, datasetId: 29, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["30%", "75%"], name: "marital", field: "age" }, legendPosition: "left" }) },
      { id: 15, title: "015 나이팅게일 차트", description: "Nightingale Chart", componentId: 7, datasetType: DatasetType.DATASET, datasetId: 29, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["20%", "75%"], name: "marital", field: "age" }, legendPosition: "left" }) },
      { id: 16, title: "016 방사형 차트", description: "Radar Chart", componentId: 9, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ color: "#2870c5", aggregation: "sum", field: "wage" }, { color: "#4ecef6", aggregation: "sum", field: "experience" }], label: true, xField: "occupation", legendPosition: "bottom" }) },
      { id: 17, title: "017 선형과 원형 복합 차트", description: "Mixed Line and Pie Chart", componentId: 32, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "education" }, { field: "yearsmarried", color: "#85c7fc", aggregation: "sum" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "occupation", field: "age" }, mark: true, xField: "age", legendPosition: "top" }) },
      { id: 18, title: "018 트리맵 차트", description: "Treemap Chart", componentId: 19, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: "year", field: "robbery" }, label: true }) },
      { id: 19, title: "019 분산형 차트", description: "Scatter Chart", componentId: 10, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ title: "이름 1", symbolSize: "20", color: "#6aa7eb", xField: "education", yField: "wage" }], legendPosition: "left" }) },
      { id: 20, title: "020 거품형 차트", description: "Bubble Chart", componentId: 8, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ title: "이름 1", color: "#6aa7eb", xField: "education", yField: "wage", sizeField: "experience" }], legendPosition: "left" }) },
      // 021~030
      { id: 21, title: "021 선버스트 차트", description: "Sunburst Chart", componentId: 22, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: ["occupation", "education"], field: "age" }, label: true }) },
      { id: 22, title: "022 계기판 차트", description: "Gauge Chart", componentId: 21, datasetType: DatasetType.DATASET, datasetId: 37, option: JSON.stringify({ color: "#6aa7eb", aggregation: "sum", field: "score", min: 0, max: 100 }) },
      { id: 23, title: "023 극좌표 막대형 차트", description: "Polar Bar Chart", componentId: 31, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], xField: "years", radius: ["10%", "75%"], legendPosition: "top" }) },
      { id: 24, title: "024 히트맵 차트", description: "Heatmap Chart", componentId: 23, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", xField: "education", yField: "occupation", field: "age" }) },
      { id: 25, title: "025 극좌표 누적 막대형 차트", description: "Polar Stacked Bar Chart", componentId: 33, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], xField: "years", radius: ["10%", "75%"], legendPosition: "top" }) },
      { id: 26, title: "026 3D 선형 차트", description: "3D Line Chart", componentId: 26, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], xField: "years", yField: "location", legendPosition: "top" }) },
      { id: 27, title: "027 영역형과 원형 복합 차트", description: "Mixed Area and Pie Chart", componentId: 34, datasetType: DatasetType.DATASET, datasetId: 27, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "annualSalary" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "educationLevel", field: "annualSalary" }, mark: true, xField: "experience", legendPosition: "top" }) },
      { id: 28, title: "028 세로 막대형과 원형 복합 차트", description: "Mixed Bar and Pie Chart", componentId: 35, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "year", field: "murder" }, mark: true, xField: "year", legendPosition: "top" }) },
      { id: 29, title: "029 가로 막대형과 원형 복합 차트", description: "Mixed Column and Pie Chart", componentId: 36, datasetType: DatasetType.DATASET, datasetId: 30, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "violent" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "year", field: "murder" }, mark: true, yField: "year", legendPosition: "top" }) },
      { id: 30, title: "030 3D 막대형 차트", description: "3D Bar Chart", componentId: 25, datasetType: DatasetType.DATASET, datasetId: 26, option: JSON.stringify({ series: [{ aggregation: "sum", field: "wage" }], color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], xField: "education", yField: "occupation" }) },
      // 031~040
      { id: 31, title: "031 3D 분산형 차트", description: "3D Scatter Chart", componentId: 27, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: [{ title: "이름 1", symbolSize: "20", color: "#6aa7eb", xField: "nox", yField: "rm", zField: "age" }], legendPosition: "left" }) },
      { id: 32, title: "032 3D 거품형 차트", description: "3D Bubble Chart", componentId: 28, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: [{ title: "이름 1", color: "#6aa7eb", xField: "nox", yField: "rm", zField: "age", sizeField: "dis" }], legendPosition: "left" }) },
      { id: 33, title: "033 캔들스틱 차트", description: "Candlestick Chart", componentId: 20, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: [{ color: "#FA5A5A", aggregation: "sum", field: "nox" }, { color: "#2870C4", aggregation: "sum", field: "rm" }, { color: "#E03B3B", aggregation: "sum", field: "age" }, { color: "#215DA3", aggregation: "sum", field: "dis" }], xField: "crim" }) },
      { id: 34, title: "034 깔때기형 차트", description: "Funnel Chart", componentId: 24, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: "crim", field: "nox" }, legendPosition: "left" }) },
      { id: 35, title: "035 누적 선형과 원형 복합 차트", description: "Mixed Stacked-Line and Pie Chart", componentId: 39, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "location", field: "price" }, label: true, xField: "years", legendPosition: "top" }) },
      { id: 36, title: "036 누적 영역형과 원형 복합 차트", description: "Mixed Stacked-Area and Pie Chart", componentId: 40, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "location", field: "price" }, label: true, xField: "years", legendPosition: "top" }) },
      { id: 37, title: "037 누적 세로 막대형과 원형 복합 차트", description: "Mixed Stacked-Bar and Pie Chart", componentId: 37, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "location", field: "price" }, label: true, xField: "years", legendPosition: "top" }) },
      { id: 38, title: "038 누적 가로 막대형과 원형 복합 차트", description: "Mixed Stacked-Column and Pie Chart", componentId: 38, datasetType: DatasetType.DATASET, datasetId: 31, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "price" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "location", field: "price" }, label: true, yField: "years", legendPosition: "top" }) },
      { id: 39, title: "039 도넛형과 원형 복합 차트", description: "Mixed Donut and Pie Chart", componentId: 41, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: { aggregation: "sum", radius: ["45%", "60%"], label: "{b}", name: "crim", field: "nox" }, pie: { radius: "30%", aggregation: "sum", label: "{b}", name: "crim", field: "rm" }, color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], legendPosition: "left" }) },
      { id: 40, title: "040 나이팅게일과 원형 복합 차트", description: "Mixed Nightingale and Pie Chart", componentId: 42, datasetType: DatasetType.DATASET, datasetId: 25, option: JSON.stringify({ series: { aggregation: "sum", radius: ["45%", "60%"], label: "{b}", name: "crim", field: "nox" }, pie: { radius: "30%", aggregation: "sum", label: "{b}", name: "crim", field: "rm" }, color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], legendPosition: "left" }) },
      // 041~050
      { id: 41, title: "041 선형 차트와 숫자 보드", description: "Line Chart and Score Board", componentId: 44, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 42, title: "042 영역형 차트와 숫자 보드", description: "Area Chart and Score Board", componentId: 45, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 43, title: "043 세로 막대형 차트와 숫자 보드", description: "Bar Chart and Score Board", componentId: 46, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 44, title: "044 가로 막대형 차트와 숫자 보드", description: "Column Chart and Score Board", componentId: 47, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, yField: "age", legendPosition: "top" }) },
      { id: 45, title: "045 누적 선형 차트와 숫자 보드", description: "Stacked Line Chart and Score Board", componentId: 48, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 46, title: "046 누적 영역형 차트와 숫자 보드", description: "Stacked Area Chart and Score Board", componentId: 49, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 47, title: "047 누적 세로 막대형 차트와 숫자 보드", description: "Stacked Bar Chart and Score Board", componentId: 50, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, xField: "age", legendPosition: "top" }) },
      { id: 48, title: "048 누적 가로 막대형 차트와 숫자 보드", description: "Stacked Column Chart and Score Board", componentId: 51, datasetType: DatasetType.DATASET, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "yearsmarried" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "yearsmarried" }, yField: "age", legendPosition: "top" }) },
      { id: 49, title: "049 도넛형 차트와 숫자 보드", description: "Donut Chart and Score Board", componentId: 52, datasetType: DatasetType.DATASET, datasetId: 27, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["40%", "75%"], name: "educationLevel", field: "annualSalary" }, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "annualSalary", numForm: true } }) },
      { id: 50, title: "050 나이팅게일 차트와 숫자 보드", description: "Nightingale Chart and Score Board", componentId: 53, datasetType: DatasetType.DATASET, datasetId: 27, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["40%", "75%"], name: "educationLevel", field: "annualSalary" }, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "annualSalary", numForm: true } }) },
      // 051~060: TABLE 타입 위젯들
      { id: 51, title: "051 숫자판", description: "Score Board", componentId: 12, datasetType: DatasetType.TABLE, datasetId: 1, option: JSON.stringify({ header: { title: "합계", fontSize: 30, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "years" } }) },
      { id: 52, title: "052 표", description: "Data Grid", componentId: 13, datasetType: DatasetType.TABLE, datasetId: 2, option: JSON.stringify({ columns: [{ name: "mode", header: "", align: "left", sortable: true }, { name: "choice", header: "", align: "left", sortable: true }, { name: "travel", header: "", align: "left", sortable: true }] }) },
      { id: 53, title: "053 선형 차트", description: "Line Chart", componentId: 1, datasetType: DatasetType.TABLE, datasetId: 3, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "visits" }, { field: "income", color: "#85c7fc", aggregation: "sum" }, { field: "access", color: "#94c983", aggregation: "sum" }, { field: "children", color: "#c1d96a", aggregation: "sum" }, { field: "health2", color: "#f4f363", aggregation: "sum" }, { field: "school", color: "#eecd5b", aggregation: "sum" }], mark: true, xField: "age", legendPosition: "top" }) },
      { id: 54, title: "054 영역형 차트", description: "Area Chart", componentId: 2, datasetType: DatasetType.TABLE, datasetId: 4, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "visits" }, { field: "income", color: "#85c7fc", aggregation: "sum" }, { field: "access", color: "#94c983", aggregation: "sum" }, { field: "children", color: "#c1d96a", aggregation: "sum" }, { field: "health2", color: "#f4f363", aggregation: "sum" }, { field: "school", color: "#eecd5b", aggregation: "sum" }], mark: true, xField: "age", legendPosition: "top" }) },
      { id: 55, title: "055 세로 막대형 차트", description: "Bar Chart", componentId: 3, datasetType: DatasetType.TABLE, datasetId: 5, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "visits" }, { field: "income", color: "#85c7fc", aggregation: "sum" }, { field: "access", color: "#94c983", aggregation: "sum" }, { field: "children", color: "#c1d96a", aggregation: "sum" }, { field: "health2", color: "#f4f363", aggregation: "sum" }, { field: "school", color: "#eecd5b", aggregation: "sum" }], mark: true, xField: "age", legendPosition: "top" }) },
      { id: 56, title: "056 가로 막대형 차트", description: "Column Chart", componentId: 4, datasetType: DatasetType.TABLE, datasetId: 6, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "visits" }, { field: "income", color: "#85c7fc", aggregation: "sum" }, { field: "access", color: "#94c983", aggregation: "sum" }, { field: "children", color: "#c1d96a", aggregation: "sum" }, { field: "health2", color: "#f4f363", aggregation: "sum" }, { field: "school", color: "#eecd5b", aggregation: "sum" }], mark: true, yField: "age", legendPosition: "top" }) },
      { id: 57, title: "057 선형과 세로 막대형 복합 차트", description: "Mixed Line and Bar Chart", componentId: 5, datasetType: DatasetType.TABLE, datasetId: 7, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", type: "line", field: "field1" }, { color: "#47a8ea", aggregation: "sum", type: "bar", field: "field2" }], label: true, xField: "xField", legendPosition: "left" }) },
      { id: 58, title: "058 누적 선형 차트", description: "Stacked Line Chart", componentId: 14, datasetType: DatasetType.TABLE, datasetId: 8, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "field1" }], label: "", xField: "xField", mark: "", legendPosition: "left" }) },
      { id: 59, title: "059 누적 영역형 차트", description: "Stacked Area Chart", componentId: 15, datasetType: DatasetType.TABLE, datasetId: 9, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "field1" }], label: "", xField: "xField", mark: "", legendPosition: "left" }) },
      { id: 60, title: "060 누적 가로 막대형 차트", description: "Stacked Column Chart", componentId: 16, datasetType: DatasetType.TABLE, datasetId: 10, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "field1" }], label: "", yField: "xField", mark: "", legendPosition: "left" }) },
      // 061~070
      { id: 61, title: "061 누적 세로 막대형 차트", description: "Stacked Bar Chart", componentId: 17, datasetType: DatasetType.TABLE, datasetId: 11, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "field1" }], label: "", xField: "xField", mark: "", legendPosition: "left" }) },
      { id: 62, title: "062 선형과 누적 세로 막대형 복합 차트", description: "Mixed Line and Stacked-Bar Chart", componentId: 43, datasetType: DatasetType.TABLE, datasetId: 12, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", type: "bar", field: "field1" }, { color: "#d0021b", aggregation: "sum", type: "line", field: "field2" }], label: "", xField: "xField", mark: true, legendPosition: "top" }) },
      { id: 63, title: "063 원형 차트", description: "Pie Chart", componentId: 6, datasetType: DatasetType.TABLE, datasetId: 13, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", name: "name", field: "value" }, legendPosition: "left" }) },
      { id: 64, title: "064 도넛형 차트", description: "Donut Chart", componentId: 11, datasetType: DatasetType.TABLE, datasetId: 14, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["30%", "75%"], name: "name", field: "value" }, legendPosition: "left" }) },
      { id: 65, title: "065 나이팅게일 차트", description: "Nightingale Chart", componentId: 7, datasetType: DatasetType.TABLE, datasetId: 15, option: JSON.stringify({ series: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], aggregation: "sum", label: "{b}", radius: ["20%", "75%"], name: "name", field: "value" }, legendPosition: "left" }) },
      { id: 66, title: "066 방사형 차트", description: "Radar Chart", componentId: 9, datasetType: DatasetType.TABLE, datasetId: 16, option: JSON.stringify({ series: [{ color: "#2870c5", aggregation: "sum", field: "value" }], label: true, xField: "name", legendPosition: "bottom" }) },
      { id: 67, title: "067 선형과 원형 복합 차트", description: "Mixed Line and Pie Chart", componentId: 32, datasetType: DatasetType.TABLE, datasetId: 17, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "field1" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, mark: true, xField: "xField", legendPosition: "top" }) },
      { id: 68, title: "068 트리맵 차트", description: "Treemap Chart", componentId: 19, datasetType: DatasetType.TABLE, datasetId: 18, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: "name", field: "value" }, label: true }) },
      { id: 69, title: "069 분산형 차트", description: "Scatter Chart", componentId: 10, datasetType: DatasetType.TABLE, datasetId: 19, option: JSON.stringify({ series: [{ title: "이름 1", symbolSize: "20", color: "#6aa7eb", xField: "x", yField: "y" }], legendPosition: "left" }) },
      { id: 70, title: "070 거품형 차트", description: "Bubble Chart", componentId: 8, datasetType: DatasetType.TABLE, datasetId: 20, option: JSON.stringify({ series: [{ title: "이름 1", color: "#6aa7eb", xField: "x", yField: "y", sizeField: "size" }], legendPosition: "left" }) },
      // 071~080
      { id: 71, title: "071 선버스트 차트", description: "Sunburst Chart", componentId: 22, datasetType: DatasetType.TABLE, datasetId: 21, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: ["cat1", "cat2"], field: "value" }, label: true }) },
      { id: 72, title: "072 계기판 차트", description: "Gauge Chart", componentId: 21, datasetType: DatasetType.TABLE, datasetId: 22, option: JSON.stringify({ color: "#6aa7eb", aggregation: "sum", field: "value", min: 0, max: 100 }) },
      { id: 73, title: "073 극좌표 막대형 차트", description: "Polar Bar Chart", componentId: 31, datasetType: DatasetType.TABLE, datasetId: 23, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], xField: "name", radius: ["10%", "75%"], legendPosition: "top" }) },
      { id: 74, title: "074 히트맵 차트", description: "Heatmap Chart", componentId: 23, datasetType: DatasetType.TABLE, datasetId: 24, option: JSON.stringify({ color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", xField: "x", yField: "y", field: "value" }) },
      { id: 75, title: "075 극좌표 누적 막대형 차트", description: "Polar Stacked Bar Chart", componentId: 33, datasetType: DatasetType.TABLE, datasetId: 25, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], xField: "name", radius: ["10%", "75%"], legendPosition: "top" }) },
      { id: 76, title: "076 3D 선형 차트", description: "3D Line Chart", componentId: 26, datasetType: DatasetType.TABLE, datasetId: 26, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], xField: "x", yField: "y", legendPosition: "top" }) },
      { id: 77, title: "077 영역형과 원형 복합 차트", description: "Mixed Area and Pie Chart", componentId: 34, datasetType: DatasetType.TABLE, datasetId: 27, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, mark: true, xField: "x", legendPosition: "top" }) },
      { id: 78, title: "078 세로 막대형과 원형 복합 차트", description: "Mixed Bar and Pie Chart", componentId: 35, datasetType: DatasetType.TABLE, datasetId: 28, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, mark: true, xField: "x", legendPosition: "top" }) },
      { id: 79, title: "079 가로 막대형과 원형 복합 차트", description: "Mixed Column and Pie Chart", componentId: 36, datasetType: DatasetType.TABLE, datasetId: 29, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, mark: true, yField: "x", legendPosition: "top" }) },
      { id: 80, title: "080 3D 막대형 차트", description: "3D Bar Chart", componentId: 25, datasetType: DatasetType.TABLE, datasetId: 30, option: JSON.stringify({ series: [{ aggregation: "sum", field: "value" }], color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], xField: "x", yField: "y" }) },
      // 081~090
      { id: 81, title: "081 3D 분산형 차트", description: "3D Scatter Chart", componentId: 27, datasetType: DatasetType.TABLE, datasetId: 31, option: JSON.stringify({ series: [{ title: "이름 1", symbolSize: "20", color: "#6aa7eb", xField: "x", yField: "y", zField: "z" }], legendPosition: "left" }) },
      { id: 82, title: "082 3D 거품형 차트", description: "3D Bubble Chart", componentId: 28, datasetType: DatasetType.TABLE, datasetId: 32, option: JSON.stringify({ series: [{ title: "이름 1", color: "#6aa7eb", xField: "x", yField: "y", zField: "z", sizeField: "size" }], legendPosition: "left" }) },
      { id: 83, title: "083 캔들스틱 차트", description: "Candlestick Chart", componentId: 20, datasetType: DatasetType.TABLE, datasetId: 33, option: JSON.stringify({ series: [{ color: "#FA5A5A", aggregation: "sum", field: "open" }, { color: "#2870C4", aggregation: "sum", field: "close" }, { color: "#E03B3B", aggregation: "sum", field: "high" }, { color: "#215DA3", aggregation: "sum", field: "low" }], xField: "date" }) },
      { id: 84, title: "084 깔때기형 차트", description: "Funnel Chart", componentId: 24, datasetType: DatasetType.TABLE, datasetId: 34, option: JSON.stringify({ series: { color: ["#2870c4", "#4ecef6", "#ffd43b", "#fa5a5a"], aggregation: "sum", name: "name", field: "value" }, legendPosition: "left" }) },
      { id: 85, title: "085 누적 선형과 원형 복합 차트", description: "Mixed Stacked-Line and Pie Chart", componentId: 39, datasetType: DatasetType.TABLE, datasetId: 35, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, label: true, xField: "x", legendPosition: "top" }) },
      { id: 86, title: "086 누적 영역형과 원형 복합 차트", description: "Mixed Stacked-Area and Pie Chart", componentId: 40, datasetType: DatasetType.TABLE, datasetId: 36, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, label: true, xField: "x", legendPosition: "top" }) },
      { id: 87, title: "087 누적 세로 막대형과 원형 복합 차트", description: "Mixed Stacked-Bar and Pie Chart", componentId: 37, datasetType: DatasetType.TABLE, datasetId: 37, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, label: true, xField: "x", legendPosition: "top" }) },
      { id: 88, title: "088 누적 가로 막대형과 원형 복합 차트", description: "Mixed Stacked-Column and Pie Chart", componentId: 38, datasetType: DatasetType.TABLE, datasetId: 38, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], pie: { color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], center: ["80%", "20%"], radius: "20%", aggregation: "sum", label: "{b}", name: "name", field: "value" }, label: true, yField: "x", legendPosition: "top" }) },
      { id: 89, title: "089 도넛형과 원형 복합 차트", description: "Mixed Donut and Pie Chart", componentId: 41, datasetType: DatasetType.TABLE, datasetId: 39, option: JSON.stringify({ series: { aggregation: "sum", radius: ["45%", "60%"], label: "{b}", name: "name", field: "value1" }, pie: { radius: "30%", aggregation: "sum", label: "{b}", name: "name", field: "value2" }, color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], legendPosition: "left" }) },
      { id: 90, title: "090 나이팅게일과 원형 복합 차트", description: "Mixed Nightingale and Pie Chart", componentId: 42, datasetType: DatasetType.TABLE, datasetId: 40, option: JSON.stringify({ series: { aggregation: "sum", radius: ["45%", "60%"], label: "{b}", name: "name", field: "value1" }, pie: { radius: "30%", aggregation: "sum", label: "{b}", name: "name", field: "value2" }, color: ["#6aa7eb", "#85c7fc", "#94c983", "#c1d96a", "#f4f363", "#eecd5b"], legendPosition: "left" }) },
      // 091~100
      { id: 91, title: "091 선형 차트와 숫자 보드", description: "Line Chart and Score Board", componentId: 44, datasetType: DatasetType.TABLE, datasetId: 41, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 92, title: "092 영역형 차트와 숫자 보드", description: "Area Chart and Score Board", componentId: 45, datasetType: DatasetType.TABLE, datasetId: 42, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 93, title: "093 세로 막대형 차트와 숫자 보드", description: "Bar Chart and Score Board", componentId: 46, datasetType: DatasetType.TABLE, datasetId: 43, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 94, title: "094 가로 막대형 차트와 숫자 보드", description: "Column Chart and Score Board", componentId: 47, datasetType: DatasetType.TABLE, datasetId: 44, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], mark: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, yField: "x", legendPosition: "top" }) },
      { id: 95, title: "095 누적 선형 차트와 숫자 보드", description: "Stacked Line Chart and Score Board", componentId: 48, datasetType: DatasetType.TABLE, datasetId: 45, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 96, title: "096 누적 영역형 차트와 숫자 보드", description: "Stacked Area Chart and Score Board", componentId: 49, datasetType: DatasetType.TABLE, datasetId: 46, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 97, title: "097 누적 세로 막대형 차트와 숫자 보드", description: "Stacked Bar Chart and Score Board", componentId: 50, datasetType: DatasetType.TABLE, datasetId: 47, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, xField: "x", legendPosition: "top" }) },
      { id: 98, title: "098 누적 가로 막대형 차트와 숫자 보드", description: "Stacked Column Chart and Score Board", componentId: 51, datasetType: DatasetType.TABLE, datasetId: 48, option: JSON.stringify({ series: [{ color: "#6aa7eb", aggregation: "sum", field: "value" }], label: true, header: { title: "합계", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value" }, yField: "x", legendPosition: "top" }) },
      { id: 99, title: "099 도넛형 차트와 숫자 보드", description: "Donut Chart and Score Board", componentId: 52, datasetType: DatasetType.TABLE, datasetId: 49, option: JSON.stringify({ series: { color: ["#6aa7eb", "#50e3c2"], aggregation: "sum", label: "{b}", radius: ["40%", "75%"], name: "name", field: "value" }, header: { title: "타이틀을 입력", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "value", numForm: true } }) },
      { id: 100, title: "100 나이팅게일 차트와 숫자 보드", description: "Nightingale Chart and Score Board", componentId: 53, datasetType: DatasetType.TABLE, datasetId: 50, option: JSON.stringify({ series: { color: ["#6aa7eb", "#50e3c2"], aggregation: "sum", label: "{b}", radius: ["40%", "75%"], name: "marital", field: "mage" }, header: { title: "타이틀을 입력", fontSize: 20, color: "#4A4A4A" }, content: { aggregation: "sum", fontSize: 50, color: "#4A4A4A", field: "mage", numForm: true } }) },
    ];

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Widget)
      .values(widgetData)
      .execute();
  }
}
