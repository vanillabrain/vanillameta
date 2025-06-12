import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { Template } from './entities/template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';

describe('TemplateController', () => {
  let controller: TemplateController;

  const mockTemplateRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockTemplateItemRepository = {
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockWidgetRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockComponentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplateController],
      providers: [
        TemplateService,
        {
          provide: getRepositoryToken(Template),
          useValue: mockTemplateRepository,
        },
        {
          provide: getRepositoryToken(TemplateItem),
          useValue: mockTemplateItemRepository,
        },
        {
          provide: getRepositoryToken(Widget),
          useValue: mockWidgetRepository,
        },
        {
          provide: getRepositoryToken(Component),
          useValue: mockComponentRepository,
        },
      ],
    }).compile();

    controller = module.get<TemplateController>(TemplateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
