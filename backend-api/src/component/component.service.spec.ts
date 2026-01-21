import { Test, TestingModule } from '@nestjs/testing';
import { ComponentService } from './component.service';
import { Component } from './entities/component.entity';
import { createMockRepository, getRepositoryTokenFor, createMockService } from '../../test/test-helpers';
import { YesNo } from '../common/enum/yn.enum';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';

describe('ComponentService', () => {
  let service: ComponentService;
  let componentRepository: any;
  let hybridCacheService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentService,
        {
          provide: getRepositoryTokenFor(Component),
          useValue: createMockRepository(),
        },
        {
          provide: HybridCacheService,
          useValue: createMockService(['get', 'set', 'del', 'invalidate', 'invalidateByEngine', 'invalidateAll']),
        },
      ],
    }).compile();

    service = module.get<ComponentService>(ComponentService);
    componentRepository = module.get(getRepositoryTokenFor(Component));
    hybridCacheService = module.get(HybridCacheService);

    // 캐시 메서드 모킹
    hybridCacheService.get.mockResolvedValue(null);
    hybridCacheService.set.mockResolvedValue(undefined);
    hybridCacheService.invalidateByEngine.mockResolvedValue(undefined);
    hybridCacheService.invalidateAll.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active components', async () => {
      const mockComponents = [
        { id: 1, type: 'chart', title: 'Chart', option: '{"type":"line"}', useYn: YesNo.YES },
        { id: 2, type: 'table', title: 'Table', option: '{"type":"basic"}', useYn: YesNo.YES },
      ];
      componentRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockComponents),
      });

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].option).toEqual({ type: 'line' });
      expect(result[1].option).toEqual({ type: 'basic' });
    });
  });

  describe('findOne', () => {
    it('should return a component by id', async () => {
      const mockComponent = { id: 1, type: 'chart', title: 'Chart' };
      componentRepository.findOne.mockResolvedValue(mockComponent);

      const result = await service.findOne(1);

      expect(result).toEqual(mockComponent);
      expect(componentRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('create', () => {
    it('should create a new component when type does not exist', async () => {
      const createDto = {
        type: 'newchart',
        title: 'New Chart',
        category: 'chart',
        option: '{"type":"bar"}',
        description: '',
        icon: '',
        seq: 0,
        useYn: 'Y',
      };
      componentRepository.findOne.mockResolvedValue(null);
      componentRepository.save.mockResolvedValue({ id: 1, ...createDto });

      const result = await service.create(createDto);

      expect(componentRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, ...createDto });
    });

    it('should return error message when component type already exists', async () => {
      const createDto = {
        type: 'chart',
        title: 'Chart',
        category: 'chart',
        option: '{"type":"line"}',
        description: '',
        icon: '',
        seq: 0,
        useYn: 'Y',
      };
      componentRepository.findOne.mockResolvedValue({ id: 1, type: 'chart' });

      const result = await service.create(createDto);

      expect(result).toBe('exist same widget');
    });
  });

  describe('remove', () => {
    it('should remove component by id', async () => {
      componentRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(componentRepository.delete).toHaveBeenCalledWith({ id: 1 });
      expect(result).toBe('This action removes a #1 component');
    });
  });
});
