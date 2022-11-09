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

describe('QTT-006 : 대시보드 템플릿 추천 알고리즘 존재 여부를 확인', () => {
  let templateService: TemplateService;
  let templateList01, templateList02;

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

  it.each([
    ['01 : 서로 다른 타입의 위젯 목록', [107, 108, 111, 112, 113]],
    ['02 : 바차트 타입의 위젯 목록', [107, 108]],
    ['03 : 알고리즘 범위를 벗어난 위젯 목록', [116, 117, 118, 119, 120, 121, 122, 123, 124, 125]],
  ])('QTT-006-%s', async (title: string, widgets) => {
    const templateResult = await templateService.findRecommendTemplates(widgets);
    templateList01 = templateResult.data;
    return expect(templateList01.length).toEqual(10);
  });

  // it('QTT-006-01 : 서로 다른 타입의 위젯 목록', async () => {
  //   const templateResult = await templateService.findRecommendTemplates([107, 108, 111, 112, 113]);
  //   templateList01 = templateResult.data;
  //
  //   return expect(templateList01.length).toEqual(10);
  // });
  //
  // it('QTT-006-02 : 바차트 타입의 위젯 목록', async () => {
  //   const templateResult = await templateService.findRecommendTemplates([107, 108]);
  //   templateList02 = templateResult.data;
  //
  //   return expect(templateList02.length).toEqual(10);
  // });
  //
  // it('QTT-006-03 : 알고리즘 범위를 벗어난 위젯 목록', async () => {
  //   const templateResult = await templateService.findRecommendTemplates([
  //     116, 117, 118, 119, 120, 121, 122, 123, 124, 125,
  //   ]);
  //   const templateList = templateResult.data;
  //   //
  //   // const templateDetail = await templateService.findOne(templateList[0].id);
  //   // console.log(':::::::::::::::::::::::::::::template detail:::::::::::::::::::::::::::::');
  //   // console.log(templateDetail);
  //
  //   return expect(templateList.length).toEqual(10);
  // });
});
