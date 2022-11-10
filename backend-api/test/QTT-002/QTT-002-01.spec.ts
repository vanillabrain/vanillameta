import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { Database } from "../../src/database/entities/database.entity";
import { ConfigModule } from '@nestjs/config';
import { TableQuery } from "../../src/widget/tabel-query/entity/table-query.entity";
import { WidgetService } from "../../src/widget/widget.service";
import * as widgetTestoption from "../../widgetTestoption-10.json"
import { Widget } from "../../src/widget/entities/widget.entity";
import { Component } from "../../src/component/entities/component.entity";
import { TableQueryService } from "../../src/widget/tabel-query/table-query.service";


describe('Check Widget Function', () => {
    let widgetService: WidgetService;
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: `.env.dev`,
                }),
                getTestMysqlModule(),
                TypeOrmModule.forFeature([Widget, Component, TableQuery, Database]),
            ],
            providers: [WidgetService, TableQueryService],
        }).compile();
        widgetService = module.get<WidgetService>(WidgetService);

    }, 10000);

    const config = {
        status: "SUCCESS",
        data: {
            "message": "success"
        }
    }
    for(let i = 0; i < widgetTestoption['default'].length; i ++){
        it('QTT-002-01: widget 생성 확인', async() => {
            const result = await widgetService.create(Object.create(widgetTestoption['default'][i]));
            return expect(result).toBeDefined();
        });
    }
    it('QTT-002-02: widget 목록 확인', async() => {
        const result = await widgetService.findAll();
        return expect(result).toEqual(result)
    })

});
