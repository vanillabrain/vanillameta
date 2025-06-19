import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatasetController } from './dataset.controller';
import { DatasetService } from './dataset.service';
import { Dataset } from './entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { ConnectionService } from '../connection/connection.service';

describe('DatasetController', () => {
  let controller: DatasetController;

  const mockDatasetRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    }),
  };

  const mockWidgetRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockConnectionService = {
    execute: jest.fn(),
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasetController],
      providers: [
        DatasetService,
        {
          provide: getRepositoryToken(Dataset),
          useValue: mockDatasetRepository,
        },
        {
          provide: getRepositoryToken(Widget),
          useValue: mockWidgetRepository,
        },
        {
          provide: ConnectionService,
          useValue: mockConnectionService,
        },
      ],
    }).compile();

    controller = module.get<DatasetController>(DatasetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
