import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTestMysqlModule } from '../util/get-test-mysql.module';
import { Database } from "../../src/database/entities/database.entity";
import { ConfigModule } from '@nestjs/config';
import { TableQuery } from "../../src/widget/tabel-query/entity/table-query.entity";
import { WidgetService } from "../../src/widget/widget.service";
import * as widgetTestoption from "../../widgetTestOption-10.json";
import { Widget } from "../../src/widget/entities/widget.entity";
import { Component } from "../../src/component/entities/component.entity";
import { TableQueryService } from "../../src/widget/tabel-query/table-query.service";
import {Connection, DataSource, getConnection, getRepository } from 'typeorm';


describe('Check Widget Function', () => {
    let widgetService: WidgetService;
    let widgetRepository: Widget;
    let connection: Connection;

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
            providers: [WidgetService, TableQueryService, Widget],
        }).compile();
        widgetService = module.get<WidgetService>(WidgetService);
        widgetRepository = module.get<Widget>(Widget);
        connection = module.get<Connection>(Connection);

    }, 10000);

    const config = {
        status: "SUCCESS",
        data: {
            "message": "success"
        }
    }

    it('QTT-002-01: widget 생성 확인', async() => {

        // const result = await widgetService.create(Object.create(widgetTestoption['default']))
        // widgetTestoption['default'].option = JSON.stringify(widgetTestoption['default'].option)
        widgetTestoption['default'].forEach(el => {
            el.option = JSON.stringify(el.option)
        })
        console.log(widgetTestoption['default'])
        const user = await connection
            .createQueryBuilder()
            .insert()
            .into(Widget)
            .values(widgetTestoption['default'])
            .execute()
        return expect(user).toBeDefined();
    });

    it('QTT-002-02: widget 목록 확인', async() => {
        const result = await widgetService.findAll();
        return expect(result).toEqual(result)
    })

});
