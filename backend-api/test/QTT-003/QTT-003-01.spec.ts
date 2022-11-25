import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { ConfigModule } from '@nestjs/config';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Component } from '../../src/component/entities/component.entity';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../../src/dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from '../../src/dashboard/dashboard-widget/dashboard-widget.service';
import { ComponentService } from '../../src/component/component.service';
import { WidgetService } from '../../src/widget/widget.service';
import { TableQueryService } from '../../src/widget/tabel-query/table-query.service';
import { TableQuery } from '../../src/widget/tabel-query/entity/table-query.entity';
import { Database } from '../../src/database/entities/database.entity';
import { TemplateService } from '../../src/template/template.service';
import { CreateDashboardDto } from '../../src/dashboard/dto/create-dashboard.dto';
import { Template } from '../../src/template/entities/template.entity';
import { TemplateItem } from '../../src/template/entities/template-item.entity';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';

describe('QTT-003: 시각화 종류', () => {
  let dashboardService: DashboardService;
  let widgetService: WidgetService;
  let componentService: ComponentService;
  let templateService: TemplateService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.dev',
        }),
        getTestMysqlModule(),
        TypeOrmModule.forFeature([
          Dashboard,
          DashboardWidget,
          Widget,
          Component,
          TableQuery,
          Database,
          Template,
          TemplateItem,
        ]),
      ],
      providers: [
        DashboardService,
        DashboardWidgetService,
        WidgetService,
        TableQueryService,
        ComponentService,
        TemplateService,
      ],
    }).compile();

    dashboardService = module.get<DashboardService>(DashboardService);
    widgetService = module.get<WidgetService>(WidgetService);
    componentService = module.get<ComponentService>(ComponentService);
    templateService = module.get<TemplateService>(TemplateService);
  }, 10000);

  const barChartList = [3, 4, 16, 17, 20, 25];
  const lineChartList = [1, 2, 14, 15, 26];
  const pieChartList = [6, 7, 9, 11, 22, 31, 33, 41, 42, 52, 53];
  const etcChartList = [
    5, 8, 10, 19, 21, 23, 24, 27, 28, 32, 34, 35, 36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49,
    50, 51,
  ];
  const etcComponentList = [12, 13];

  const testData = [
    ['01: varchart 위젯 목록 확인', 'QTT-003-01 바차트 계열 시각화', barChartList],
    ['02: linechart 위젯 목록 확인', 'QTT-003-02 라인차트 계열 시각화', lineChartList],
    ['03: piechart 위젯 목록 확인', 'QTT-003-03 파이차트 계열 시각화', pieChartList],
    ['04: etcchart 위젯 목록 확인', 'QTT-003-04 기타 차트 계열 시각화 확인', etcChartList],
    ['05: etcComponent 위젯 목록 확인', 'QTT-003-05 기타 시각화 확인', etcComponentList],
  ];

  it.each(testData)(
    'QTT-003-%s',
    async (name: string, dashboardTitle: string, componentList: number[]) => {
      let findWidgetInfo = await widgetService.findAll();
      let widgetIdList = [];
      for (let i = 0; i < componentList.length; i++) {
        const tempWidgetObj = findWidgetInfo.data.find(
          item => item.componentId === componentList[i],
        );
        widgetIdList.push(tempWidgetObj.id);
      }

      const layoutResult = await templateService.getTemplateDashboardLayout(widgetIdList, 8);
      const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
      createDashboardDto.title = dashboardTitle;
      createDashboardDto.layout = layoutResult.data.layout;
      const createDashboardResult = await dashboardService.create(createDashboardDto);
      console.log('::::::::생성된 대시보드 id :: ', createDashboardResult.data.id);
      return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    },
  );
});
