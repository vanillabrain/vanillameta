import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { Database } from './entities/database.entity';
import { DatabaseType } from './entities/database_type.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/table-query/entity/table-query.entity';
import { ConnectionService } from '../connection/connection.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let databaseRepository: any;
  let databaseTypeRepository: any;
  let datasetRepository: any;
  let tableQueryRepository: any;
  let connectionService: any;
  let cacheManager: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: getRepositoryTokenFor(Database),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(DatabaseType),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Dataset),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(TableQuery),
          useValue: createMockRepository(),
        },
        {
          provide: ConnectionService,
          useValue: createMockService([
            'testConnection',
            'createConnection',
            'getSchema',
            'executeQuery',
          ]),
        },
        {
          provide: CACHE_MANAGER,
          useValue: createMockService(['get', 'set', 'del', 'reset']),
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    databaseRepository = module.get(getRepositoryTokenFor(Database));
    databaseTypeRepository = module.get(getRepositoryTokenFor(DatabaseType));
    datasetRepository = module.get(getRepositoryTokenFor(Dataset));
    tableQueryRepository = module.get(getRepositoryTokenFor(TableQuery));
    connectionService = module.get<ConnectionService>(ConnectionService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllDbTypes', () => {
    it('should return list of all database types ordered by seq and type', async () => {
      const mockDatabaseTypes = [
        { id: 1, name: 'MySQL', engine: 'mysql2', useYn: YesNo.YES, seq: 1, type: 'A' },
        { id: 2, name: 'PostgreSQL', engine: 'pg', useYn: YesNo.YES, seq: 2, type: 'B' },
      ];
      cacheManager.get.mockResolvedValue(null); // 캐시에 없음
      databaseTypeRepository.find.mockResolvedValue(mockDatabaseTypes);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.findAllDbTypes();

      expect(result).toEqual(mockDatabaseTypes);
      expect(databaseTypeRepository.find).toHaveBeenCalledWith({ order: { seq: 'ASC', type: 'ASC' } });
    });
  });

  describe('create', () => {
    it('should create a new database connection', async () => {
      const createDto = {
        name: 'Test DB',
        description: 'Test database',
        connectionConfig: JSON.stringify({
          host: 'localhost',
          port: 3306,
          user: 'testuser',
          password: 'testpass',
          database: 'testdb',
        }),
        engine: 'mysql2',
        type: 'mysql',
        timezone: 'Asia/Seoul',
      };
      const savedDatabase = { id: 1, ...createDto };

      // Mock Database.toDto static method
      const mockDatabase = new Database();
      Object.assign(mockDatabase, {
        id: 1,
        ...createDto,
        getFullDescription: () => `${createDto.name} ${createDto.description}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockToDto = jest.spyOn(Database, 'toDto').mockReturnValue(mockDatabase);

      databaseRepository.save.mockResolvedValue(savedDatabase);

      const result = await service.create(createDto);

      expect(mockToDto).toHaveBeenCalledWith(createDto);
      expect(databaseRepository.save).toHaveBeenCalled();

      mockToDto.mockRestore();
    });
  });
});
