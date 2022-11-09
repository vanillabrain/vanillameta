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

describe('QTT-005 : 사용자 추천 템플릿의 종류를 확인', () => {
  let templateService: TemplateService;

  let templateList;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TemplateModule,
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.dev',
        }),
        getTestMysqlModule(),
        TypeOrmModule.forFeature([Template, TemplateItem, Widget, Component]),
      ],
      providers: [TemplateService],
    }).compile();

    templateService = module.get<TemplateService>(TemplateService);
  }, 100000);

  it('QTT-005-01 : 템플릿 종류 10개 확인', async () => {
    const templateResult = await templateService.findAll();
    templateList = templateResult.data;

    return expect(templateList.length).toEqual(10);
  });

  afterEach(async () => {
    const templateDetail = await templateService.findOne(templateList[0].id);
    console.log(
      ':::::::::::::::::::::::::::::template detail:::::::::::::::::::::::::::::\n',
      templateDetail.data,
    );
  });
});
