import { Test, TestingModule } from '@nestjs/testing';
import { TemplateService } from '../../src/template/template.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from '../../src/template/entities/template.entity';
import { TemplateItem } from '../../src/template/entities/template-item.entity';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Component } from '../../src/component/entities/component.entity';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { TemplateModule } from '../../src/template/template.module';
import { ConfigModule } from '@nestjs/config';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { DashboardModule } from '../../src/dashboard/dashboard.module';
import { CreateDashboardDto } from '../../dist/dashboard/dto/create-dashboard.dto';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../../src/dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from '../../src/dashboard/dashboard-widget/dashboard-widget.service';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';
import { WidgetService } from '../../src/widget/widget.service';
import { TableQuery } from '../../src/widget/tabel-query/entity/table-query.entity';
import { Database } from '../../src/database/entities/database.entity';
import { TableQueryService } from '../../src/widget/tabel-query/table-query.service';

describe('QTT-006 : 대시보드 템플릿 추천', () => {
  let templateService: TemplateService;
  let dashboardService: DashboardService;
  let widgetService: WidgetService;
  let templateList01, templateList02;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TemplateModule,
        DashboardModule,
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.dev',
        }),
        getTestMysqlModule(),
        TypeOrmModule.forFeature([
          Template,
          TemplateItem,
          Widget,
          Component,
          Dashboard,
          DashboardWidget,
          Database,
          TableQuery,
        ]),
      ],
      providers: [
        TemplateService,
        DashboardService,
        DashboardWidgetService,
        WidgetService,
        TableQueryService,
      ],
    }).compile();

    templateService = module.get<TemplateService>(TemplateService);
    dashboardService = module.get<DashboardService>(DashboardService);
    widgetService = module.get<WidgetService>(WidgetService);
  }, 100000);

  it('QTT-006-01 : 서로 다른 타입의 위젯 목록', async () => {
    const componentList = [15, 12, 41, 13, 38];

    let findWidgetInfo = await widgetService.findAll();
    let widgetIdList = [];
    for (let i = 0; i < componentList.length; i++) {
      const tempWidgetObj = findWidgetInfo.data.find(item => item.componentId === componentList[i]);
      widgetIdList.push(tempWidgetObj.id);
    }

    const templateResult = await templateService.findRecommendTemplates(widgetIdList);
    templateList01 = templateResult.data;

    return expect(templateList01.length).toEqual(10);
  });

  it('QTT-006-02 : 바차트 타입의 위젯 목록', async () => {
    const componentList = [3, 4, 16, 17, 20, 25];
    let findWidgetInfo = await widgetService.findAll();
    let widgetIdList = [];
    for (let i = 0; i < componentList.length; i++) {
      const tempWidgetObj = findWidgetInfo.data.find(item => item.componentId === componentList[i]);
      widgetIdList.push(tempWidgetObj.id);
    }

    const templateResult = await templateService.findRecommendTemplates(widgetIdList);
    templateList02 = templateResult.data;

    // QTT-006-01의 결과와 다름을 확인
    return expect(templateList02).not.toEqual(templateList01);
  });

  it('QTT-006-03 : 알고리즘 범위를 벗어난 위젯 목록', async () => {
    const componentList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let findWidgetInfo = await widgetService.findAll();
    let widgetIdList = [];
    for (let i = 0; i < componentList.length; i++) {
      const tempWidgetObj = findWidgetInfo.data.find(item => item.componentId === componentList[i]);
      widgetIdList.push(tempWidgetObj.id);
    }

    const templateResult = await templateService.findRecommendTemplates(widgetIdList);
    const templateList = templateResult.data;
    const layoutResult = await templateService.getTemplateDashboardLayout(
      widgetIdList,
      templateList[0].id,
    );

    const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
    createDashboardDto.title = 'QTT-006-03 dashboard';
    createDashboardDto.layout = layoutResult.data.layout;
    const createDashboardResult = await dashboardService.create(createDashboardDto);

    console.log(
      '::::::::::::::대시보드 위젯 배치 확인::::::::::::::\n',
      createDashboardResult.data,
    );
    return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
  });
});
