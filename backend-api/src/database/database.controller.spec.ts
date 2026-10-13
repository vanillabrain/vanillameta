import { SourceAccessService } from '../ownership/source-access.service';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from './entities/database.entity';
import { DatabaseType } from './entities/database_type.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { DuckDBService } from '../analysis/duckdb.service';

describe('DatabaseController', () => {
  let controller: DatabaseController;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseController],
      providers: [
        { provide: SourceAccessService, useValue: {} },
        DatabaseService,
        { provide: DuckDBService, useValue: {} },
        { provide: ConnectionService, useValue: { executeQuery: jest.fn() } },
        { provide: getRepositoryToken(Database), useFactory: mockRepository },
        { provide: getRepositoryToken(DatabaseType), useFactory: mockRepository },
        { provide: getRepositoryToken(Dataset), useFactory: mockRepository },
        { provide: getRepositoryToken(TableQuery), useFactory: mockRepository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DatabaseController>(DatabaseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
