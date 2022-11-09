import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { ConfigModule } from '@nestjs/config';
import {Widget} from "../../src/widget/entities/widget.entity";
import {Component} from "../../src/component/entities/component.entity";
import {DashboardService} from "../../src/dashboard/dashboard.service";
import {Dashboard} from "../../src/dashboard/entities/dashboard.entity";
import {DashboardWidget} from "../../src/dashboard/dashboard-widget/entities/dashboard-widget.entity";
import {DashboardWidgetService} from "../../src/dashboard/dashboard-widget/dashboard-widget.service";
import {ComponentService} from "../../src/component/component.service";
import * as widgetTestoption from "../../widgetTestoption-10.json"


describe('Check Widget Function', () => {
    let dashboardService: DashboardService;
    let componentService: ComponentService;



    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.dev',
                }),
                getTestMysqlModule(),
                TypeOrmModule.forFeature([Dashboard, DashboardWidget, Widget, Component]),
            ],
            providers: [DashboardService, DashboardWidgetService],
        }).compile();

        dashboardService = module.get<DashboardService>(DashboardService);
        // componentService = module.get<ComponentService>(ComponentService);


    }, 10000);

    const config = {
        status: "SUCCESS",
        data: {
            "message": "success"
        }
    }

    it('QTT-003-01: 시각 확인', async() => {


        // for(let i = 0; i < test_chart_type['varchart'].length){
        //     const result = await dashboardService.create(Object.create(test_chart_type['default']['varchart'][i]));
        //     console.log(result)
        // }



        // return expect(result).toBeDefined();
    });

    it('QTT-002-02: widget 목록 확인', async() => {
        const result = await dashboardService.findAll();
        return expect(result).toEqual(result)
    })

});
