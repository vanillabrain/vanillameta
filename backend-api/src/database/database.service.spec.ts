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

describe('DatabaseService', () => {
  let service: DatabaseService;
  let databaseRepository: any;
  let databaseTypeRepository: any;
  let datasetRepository: any;
  let tableQueryRepository: any;
  let connectionService: any;

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
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    databaseRepository = module.get(getRepositoryTokenFor(Database));
    databaseTypeRepository = module.get(getRepositoryTokenFor(DatabaseType));
    datasetRepository = module.get(getRepositoryTokenFor(Dataset));
    tableQueryRepository = module.get(getRepositoryTokenFor(TableQuery));
    connectionService = module.get<ConnectionService>(ConnectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTypeList', () => {
    it('should return list of active database types', async () => {
      const mockDatabaseTypes = [
        { id: 1, name: 'MySQL', engine: 'mysql2', useYn: YesNo.YES },
        { id: 2, name: 'PostgreSQL', engine: 'pg', useYn: YesNo.YES },
      ];
      databaseTypeRepository.find.mockResolvedValue(mockDatabaseTypes);

      const result = await service.findTypeList();

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(mockDatabaseTypes);
      expect(databaseTypeRepository.find).toHaveBeenCalledWith({ where: { useYn: YesNo.YES } });
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
