import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatasetService } from './dataset.service';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from './entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';

describe('DatasetService', () => {
  let service: DatasetService;
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
        DatasetService,
        { provide: getRepositoryToken(Dataset), useFactory: mockRepository },
        { provide: getRepositoryToken(Widget), useFactory: mockRepository },
        { provide: ConnectionService, useValue: { executeQuery: jest.fn() } },
      ],
    }).compile();

    service = module.get<DatasetService>(DatasetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
