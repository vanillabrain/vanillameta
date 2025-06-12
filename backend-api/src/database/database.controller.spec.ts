import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { Database } from './entities/database.entity';
import { DatabaseType } from './entities/database_type.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/table-query/entity/table-query.entity';
import { ConnectionService } from '../connection/connection.service';

describe('DatabaseController', () => {
  let controller: DatabaseController;

  const mockDatabaseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockDatabaseTypeRepository = {
    find: jest.fn(),
  };

  const mockDatasetRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    }),
  };

  const mockTableQueryRepository = {
    find: jest.fn(),
  };

  const mockConnectionService = {
    execute: jest.fn(),
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseController],
      providers: [
        DatabaseService,
        {
          provide: getRepositoryToken(Database),
          useValue: mockDatabaseRepository,
        },
        {
          provide: getRepositoryToken(DatabaseType),
          useValue: mockDatabaseTypeRepository,
        },
        {
          provide: getRepositoryToken(Dataset),
          useValue: mockDatasetRepository,
        },
        {
          provide: getRepositoryToken(TableQuery),
          useValue: mockTableQueryRepository,
        },
        {
          provide: ConnectionService,
          useValue: mockConnectionService,
        },
      ],
    }).compile();

    controller = module.get<DatabaseController>(DatabaseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
