import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { ConfigModule } from '@nestjs/config';
import { Widget } from "../../src/widget/entities/widget.entity";
import { Component } from "../../src/component/entities/component.entity";
import { DashboardService } from "../../src/dashboard/dashboard.service";
import { Dashboard } from "../../src/dashboard/entities/dashboard.entity";
import { DashboardWidget } from "../../src/dashboard/dashboard-widget/entities/dashboard-widget.entity";
import { DashboardWidgetService } from "../../src/dashboard/dashboard-widget/dashboard-widget.service";
import { ComponentService } from "../../src/component/component.service";
import { WidgetService } from "../../src/widget/widget.service";
import { TableQueryService } from "../../src/widget/tabel-query/table-query.service";
import { TableQuery } from "../../src/widget/tabel-query/entity/table-query.entity";
import { Database } from "../../src/database/entities/database.entity";
import { TemplateService } from '../../src/template/template.service';
import { CreateDashboardDto } from '../../src/dashboard/dto/create-dashboard.dto';
import { Template } from '../../src/template/entities/template.entity';
import { TemplateItem } from '../../src/template/entities/template-item.entity';
import { ResponseStatus } from '../../src/common/enum/response-status.enum';


describe('Check Widget Function', () => {
    let dashboardService: DashboardService;
    let widgetService: WidgetService;
    let componentService: ComponentService;
    let templateService: TemplateService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.dev',
                }),
                getTestMysqlModule(),
                TypeOrmModule.forFeature([Dashboard, DashboardWidget, Widget, Component, TableQuery, Database, Template, TemplateItem])
            ],
            providers: [DashboardService, DashboardWidgetService, WidgetService, TableQueryService, ComponentService, TemplateService]
        }).compile();

        dashboardService = module.get<DashboardService>(DashboardService);
        widgetService = module.get<WidgetService>(WidgetService);
        componentService = module.get<ComponentService>(ComponentService);
        templateService = module.get<TemplateService>(TemplateService);
    }, 10000);

    const config = {
        status: "SUCCESS",
        data: {
            "message": "success"
        }
    }
    const varchart = ["가로 막대형 차트", "세로 막대형 차트", "누적 가로 막대형 차트", "누적 세로 막대형 차트", "캔들스틱 차트", "3d 막대형 차트"];
    const linechart = ["선형차트", "영역형차트", "누적 선형 차트", "누적 영역형 차트", "3d 선형 차트"];
    const piechart = ["원형차트", "도넛형차트", "나이팅게일 차트","방사형 차트","선버스트 차트","극좌표 막대형 차트","극좌표 누적 막대형 차트","도넛형과 원형 복합 차트","나이팅게일과 원형 복합차트","도넛형 차트와 숫자보드","나이팅게일 차트와 숫자보드"]
    const etcchart = ["선형과 세로막대형 복합차트","선형과 누적 세로 막대형 복합 차트","분산형 차트","거품형 차트","트리형 차트","히트맵차트","계기판 차트","깔대기형 차트","3d 분산형 차트","3d 거품형 차트","선형과 원형 복합 차트","영역형과 원형 복합 차트","세로막대형과 원형 복합 차트","가로막대형과 원형 복합 차트","누적 세로 막대형과 원형 복합 차트","누적 가로 막대형과 원형 복합 차트","누적 선형과 원형 복합 차트","누적 영역형과 원형 복합차트"
        ,"선형 차트와 숫자 보드","영역형 차트와 숫자 보드","세로 막대형 차트와 숫자보드","가로 막대형 차트와 숫자보드","누적 선형 차트와 숫자보드","누적 영역형 차트와 숫자보드","누적 세로 막대형 차트와 숫자보드","누적 가로 막대형 차트와 숫자보드"]
    const etccomponent = ['숫자판', '표']

    it('QTT-003-01: varchart 위젯 목록 확인', async() => {
        let findWidgetInfo = await widgetService.findAll();
        let widgetId = [];
        let result = [];
        for(let i = 0; i < varchart.length; i ++) {
            widgetId.push(findWidgetInfo.data.filter(el => el.title === varchart[i]));
        }
        widgetId = widgetId.flat();
        result = widgetId.map(el => el.id)
        const templateResult = await templateService.findRecommendTemplates(result);
        const templateList = templateResult.data;
        const layoutResult = await templateService.getTemplateDashboardLayout(
            result,
            templateList[0].id,
        );

        const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
        createDashboardDto.title = 'QTT-003-01 dashboard';
        createDashboardDto.layout = layoutResult.data.layout;
        const createDashboardResult = await dashboardService.create(createDashboardDto);

        return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    });

    it('QTT-003-02: linechart 위젯 목록 확인', async() => {
        let findWidgetInfo = await widgetService.findAll();
        let widgetId = [];
        let result = [];
        for(let i = 0; i < linechart.length; i ++) {
            widgetId.push(findWidgetInfo.data.filter(el => el.title === linechart[i]));
        }
        widgetId = widgetId.flat();
        result = widgetId.map(el => el.id)
        const templateResult = await templateService.findRecommendTemplates(result);
        const templateList = templateResult.data;
        const layoutResult = await templateService.getTemplateDashboardLayout(
            result,
            templateList[0].id,
        );

        const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
        createDashboardDto.title = 'QTT-003-02 dashboard';
        createDashboardDto.layout = layoutResult.data.layout;
        const createDashboardResult = await dashboardService.create(createDashboardDto);

        return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    });

    it('QTT-003-03: piechart 위젯 목록 확인', async() => {
        let findWidgetInfo = await widgetService.findAll();
        let widgetId = [];
        let result = [];
        for(let i = 0; i < piechart.length; i ++) {
            widgetId.push(findWidgetInfo.data.filter(el => el.title === piechart[i]));
        }
        widgetId = widgetId.flat();
        result = widgetId.map(el => el.id)
        const templateResult = await templateService.findRecommendTemplates(result);
        const templateList = templateResult.data;
        const layoutResult = await templateService.getTemplateDashboardLayout(
            result,
            templateList[0].id,
        );

        const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
        createDashboardDto.title = 'QTT-003-03 dashboard';
        createDashboardDto.layout = layoutResult.data.layout;
        const createDashboardResult = await dashboardService.create(createDashboardDto);

        return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    });

    it('QTT-003-04: etcchart 위젯 목록 확인', async() => {
        let findWidgetInfo = await widgetService.findAll();
        let widgetId = [];
        let result = [];
        for(let i = 0; i < etcchart.length; i ++) {
            widgetId.push(findWidgetInfo.data.filter(el => el.title === etcchart[i]));
        }
        widgetId = widgetId.flat();
        result = widgetId.map(el => el.id)
        const templateResult = await templateService.findRecommendTemplates(result);
        const templateList = templateResult.data;
        const layoutResult = await templateService.getTemplateDashboardLayout(
            result,
            templateList[0].id,
        );

        const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
        createDashboardDto.title = 'QTT-003-04 dashboard';
        createDashboardDto.layout = layoutResult.data.layout;
        const createDashboardResult = await dashboardService.create(createDashboardDto);

        return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    });

    it('QTT-003-05: etcComponent 위젯 목록 확인', async() => {
        let findWidgetInfo = await widgetService.findAll();
        let widgetId = [];
        let result = [];
        for(let i = 0; i < etccomponent.length; i ++) {
            widgetId.push(findWidgetInfo.data.filter(el => el.title === etccomponent[i]));
        }
        widgetId = widgetId.flat();
        result = widgetId.map(el => el.id)
        const templateResult = await templateService.findRecommendTemplates(result);
        const templateList = templateResult.data;
        const layoutResult = await templateService.getTemplateDashboardLayout(
            result,
            templateList[0].id,
        );

        const createDashboardDto: CreateDashboardDto = new CreateDashboardDto();
        createDashboardDto.title = 'QTT-003-05 dashboard';
        createDashboardDto.layout = layoutResult.data.layout;
        const createDashboardResult = await dashboardService.create(createDashboardDto);

        return expect(createDashboardResult.status).toEqual(ResponseStatus.SUCCESS);
    });

});
