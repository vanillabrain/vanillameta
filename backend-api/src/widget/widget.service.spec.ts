import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WidgetService } from './widget.service';
import { TableQueryService } from './tabel-query/table-query.service';
import { Widget } from './entities/widget.entity';
import { Component } from '../component/entities/component.entity';

describe('WidgetService', () => {
  let service: WidgetService;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        { provide: getRepositoryToken(Widget), useFactory: mockRepository },
        { provide: getRepositoryToken(Component), useFactory: mockRepository },
        { provide: TableQueryService, useValue: {} },
      ],
    }).compile();

    service = module.get<WidgetService>(WidgetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
