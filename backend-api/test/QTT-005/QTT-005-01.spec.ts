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

describe('사용자 추천 템플릿의 종류를 확인', () => {
  let templateService: TemplateService;

  beforeEach(async () => {
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
  }, 10000);

  it('should be defined', async () => {
    const templateList = await templateService.findAll();
    return expect(templateList.data.length).toEqual(10);
  });
});
