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

describe('QTT-006 : 대시보드 템플릿 추천 알고리즘 존재 여부를 확인', () => {
  let templateService: TemplateService;
  let dashboardService: DashboardService;
  let resultList = [];
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
        ]),
      ],
      providers: [TemplateService, DashboardService, DashboardWidgetService],
    }).compile();

    templateService = module.get<TemplateService>(TemplateService);
    dashboardService = module.get<DashboardService>(DashboardService);
  }, 100000);

  // it.each([
  //   ['01 : 서로 다른 타입의 위젯 목록', [107, 108, 111, 112, 113], 10],
  //   ['02 : 바차트 타입의 위젯 목록', [107, 108], false],
  //   ['03 : 알고리즘 범위를 벗어난 위젯 목록', [116, 117, 118, 119, 120, 121, 122, 123, 124, 125]],
  // ])('QTT-006-%s', async (title: string, widgets, expectResult) => {
  //   const templateResult = await templateService.findRecommendTemplates(widgets);
  //   const templateList = templateResult.data;
  //   resultList.push(templateList);
  //   return expect(templateList.length).toEqual(10);
  // });

  // afterAll(async () => {
  //   return expect(resultList[0]).not.toEqual(resultList[0]);
  //   console.log(resultList.length);
  // });

  it('QTT-006-01 : 서로 다른 타입의 위젯 목록', async () => {
    const templateResult = await templateService.findRecommendTemplates([107, 108, 111, 112, 113]);
    templateList01 = templateResult.data;

    return expect(templateList01.length).toEqual(10);
  });

  it('QTT-006-02 : 바차트 타입의 위젯 목록', async () => {
    const templateResult = await templateService.findRecommendTemplates([107, 108]);
    templateList02 = templateResult.data;

    // QTT-006-01의 결과와 다름을 확인
    return expect(templateList02).not.toEqual(templateList01);
  });

  it('QTT-006-03 : 알고리즘 범위를 벗어난 위젯 목록', async (widgets = [
    116, 117, 118, 119, 120, 121, 122, 123, 124, 125,
  ]) => {
    const templateResult = await templateService.findRecommendTemplates(widgets);
    const templateList = templateResult.data;
    const layoutResult = await templateService.getTemplateDashboardLayout(
      widgets,
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
