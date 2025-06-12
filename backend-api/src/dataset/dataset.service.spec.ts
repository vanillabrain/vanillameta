import { Test, TestingModule } from '@nestjs/testing';
import { DatasetService } from './dataset.service';
import { Dataset } from './entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { ConnectionService } from '../connection/connection.service';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { DatasetType } from '../common/enum/dataset-type.enum';

describe('DatasetService', () => {
  let service: DatasetService;
  let datasetRepository: any;
  let widgetRepository: any;
  let connectionService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetService,
        {
          provide: getRepositoryTokenFor(Dataset),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(Widget),
          useValue: createMockRepository(),
        },
        {
          provide: ConnectionService,
          useValue: createMockService(['executeQuery', 'testConnection']),
        },
      ],
    }).compile();

    service = module.get<DatasetService>(DatasetService);
    datasetRepository = module.get(getRepositoryTokenFor(Dataset));
    widgetRepository = module.get(getRepositoryTokenFor(Widget));
    connectionService = module.get<ConnectionService>(ConnectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new dataset when query is valid', async () => {
      const createDto = {
        title: 'Test Dataset',
        databaseId: 1,
        query: 'SELECT * FROM users',
      };
      const mockQueryResult = {
        status: ResponseStatus.SUCCESS,
        data: [{ id: 1, name: 'John' }],
        columns: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string' },
        ],
      };
      const savedDataset = { id: 1, ...createDto };

      connectionService.executeQuery.mockResolvedValue(mockQueryResult);
      datasetRepository.save.mockResolvedValue(savedDataset);

      const result = await service.create(createDto);

      expect(connectionService.executeQuery).toHaveBeenCalledWith({
        id: createDto.databaseId,
        query: createDto.query,
      });
      expect(datasetRepository.save).toHaveBeenCalled();
    });

    it('should return error when query execution fails', async () => {
      const createDto = {
        title: 'Test Dataset',
        databaseId: 1,
        query: 'INVALID QUERY',
      };
      const mockQueryResult = {
        status: ResponseStatus.ERROR,
        message: 'SQL syntax error',
      };

      connectionService.executeQuery.mockResolvedValue(mockQueryResult);

      const result = await service.create(createDto);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(datasetRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all datasets', async () => {
      const mockDatasets = [
        { id: 1, name: 'Dataset 1', type: DatasetType.DATASET },
        { id: 2, name: 'Dataset 2', type: DatasetType.TABLE },
      ];
      datasetRepository.find.mockResolvedValue(mockDatasets);

      const result = await service.findAll();

      expect(result).toEqual(mockDatasets);
    });
  });
});
