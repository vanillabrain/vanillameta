import { Test, TestingModule } from '@nestjs/testing';
import { PaginationService } from './pagination.service';
import { SelectQueryBuilder } from 'typeorm';
import { CursorPaginationOptions, OffsetPaginationOptions } from './pagination.interface';

// Mock entity
class TestEntity {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

describe('PaginationService', () => {
  let service: PaginationService;
  let mockQueryBuilder: Partial<SelectQueryBuilder<TestEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaginationService],
    }).compile();

    service = module.get<PaginationService>(PaginationService);

    // Mock QueryBuilder 설정
    mockQueryBuilder = {
      clone: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
      getCount: jest.fn(),
    };

    // clone이 새로운 mock 인스턴스를 반환하도록 설정
    (mockQueryBuilder.clone as jest.Mock).mockImplementation(() => ({
      ...mockQueryBuilder,
      clone: jest.fn().mockReturnThis(),
    }));
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('paginateCursor', () => {
    it('커서 기반 페이지네이션을 적용해야 함', async () => {
      const mockEntities = [
        { id: 1, title: 'First', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
        { id: 2, title: 'Second', createdAt: new Date('2025-01-02'), updatedAt: new Date('2025-01-02') },
        { id: 3, title: 'Third', createdAt: new Date('2025-01-03'), updatedAt: new Date('2025-01-03') },
      ];

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockEntities);
      (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);

      const options: CursorPaginationOptions = {
        limit: 2,
        sortDirection: 'DESC',
        sortField: 'createdAt',
      };

      const result = await service.paginateCursor(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
        { alias: 'test' },
      );

      expect(result.data).toHaveLength(2); // limit만큼만 반환
      expect(result.meta.hasNext).toBe(true); // 3개가 limit(2)보다 많으므로
      expect(result.meta.limit).toBe(2);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('test.createdAt', 'DESC');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(3); // limit + 1
    });

    it('nextCursor가 있을 때 WHERE 조건을 추가해야 함', async () => {
      const mockEntities = [
        { id: 4, title: 'Fourth', createdAt: new Date('2025-01-04'), updatedAt: new Date('2025-01-04') },
        { id: 5, title: 'Fifth', createdAt: new Date('2025-01-05'), updatedAt: new Date('2025-01-05') },
      ];

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockEntities);

      const nextCursor = 'eyJpZCI6MywiZGF0YSI6IjIwMjUtMDEtMDMifQ'; // Base64 encoded cursor
      const options: CursorPaginationOptions = {
        limit: 2,
        nextCursor,
      };

      await service.paginateCursor(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('limit보다 많은 결과가 있을 때 hasNext를 true로 설정해야 함', async () => {
      const mockEntities = [
        { id: 1, title: 'First', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, title: 'Second', createdAt: new Date(), updatedAt: new Date() },
        { id: 3, title: 'Third', createdAt: new Date(), updatedAt: new Date() },
      ];

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockEntities);

      const options: CursorPaginationOptions = { limit: 2 };

      const result = await service.paginateCursor(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(result.data).toHaveLength(2); // limit만큼만 반환
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
    });

    it('previousCursor가 있을 때 결과를 뒤집어야 함', async () => {
      const mockEntities = [
        { id: 3, title: 'Third', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, title: 'Second', createdAt: new Date(), updatedAt: new Date() },
        { id: 1, title: 'First', createdAt: new Date(), updatedAt: new Date() },
      ];

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([...mockEntities]);
      (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(1);

      const options: CursorPaginationOptions = {
        limit: 3,
        previousCursor: 'eyJpZCI6NH0', // Base64 encoded
      };

      const result = await service.paginateCursor(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      // 결과가 뒤집혀야 함
      expect(result.data[0].id).toBe(1);
      expect(result.data[1].id).toBe(2);
      expect(result.data[2].id).toBe(3);
    });

    it('includeTotalCount가 true일 때 전체 개수를 포함해야 함', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);
      (mockQueryBuilder.getCount as jest.Mock).mockResolvedValue(100);

      const options: CursorPaginationOptions = { limit: 10 };

      const result = await service.paginateCursor(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
        { alias: 'test', includeTotalCount: true },
      );

      expect(result.meta.total).toBe(100);
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
    });
  });

  describe('paginateOffset', () => {
    it('오프셋 기반 페이지네이션을 적용해야 함', async () => {
      const mockEntities = [
        { id: 11, title: 'Item 11', createdAt: new Date(), updatedAt: new Date() },
        { id: 12, title: 'Item 12', createdAt: new Date(), updatedAt: new Date() },
      ];

      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockEntities, 50]);

      const options: OffsetPaginationOptions = {
        page: 2,
        limit: 10,
      };

      const result = await service.paginateOffset(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(result.data).toEqual(mockEntities);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(50);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
      
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (page-1) * limit
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('첫 페이지에서는 hasPrevious가 false여야 함', async () => {
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 100]);

      const options: OffsetPaginationOptions = {
        page: 1,
        limit: 20,
      };

      const result = await service.paginateOffset(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(result.meta.hasPrevious).toBe(false);
      expect(result.meta.hasNext).toBe(true);
    });

    it('마지막 페이지에서는 hasNext가 false여야 함', async () => {
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 100]);

      const options: OffsetPaginationOptions = {
        page: 5,
        limit: 20,
      };

      const result = await service.paginateOffset(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(true);
    });

    it('정렬 옵션을 적용해야 함', async () => {
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const options: OffsetPaginationOptions = {
        page: 1,
        limit: 10,
        sortField: 'title',
        sortDirection: 'ASC',
      };

      await service.paginateOffset(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
        { alias: 'entity' },
      );

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('entity.title', 'ASC');
    });

    it('커서도 함께 제공해야 함 (하이브리드 지원)', async () => {
      const mockEntities = [
        { id: 1, title: 'First', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, title: 'Second', createdAt: new Date(), updatedAt: new Date() },
      ];

      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([mockEntities, 10]);

      const result = await service.paginateOffset(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        { page: 1, limit: 5 },
      );

      expect(result.meta.nextCursor).toBeDefined();
      expect(result.meta.previousCursor).toBeUndefined(); // 첫 페이지
    });
  });

  describe('paginate', () => {
    it('커서가 있으면 커서 기반 페이지네이션을 사용해야 함', async () => {
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      const validCursorData = { id: 123 };
      const validCursor = Buffer.from(JSON.stringify(validCursorData)).toString('base64url');
      
      const options = {
        nextCursor: validCursor,
        limit: 10,
      };

      await service.paginate(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(11); // 커서 기반은 limit + 1
    });

    it('페이지가 있으면 오프셋 기반 페이지네이션을 사용해야 함', async () => {
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const options = {
        page: 2,
        limit: 10,
      };

      await service.paginate(
        mockQueryBuilder as SelectQueryBuilder<TestEntity>,
        options,
      );

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('paginateArray', () => {
    it('배열을 페이지네이션해야 함', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

      const result = service.paginateArray(items, { page: 2, limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(11);
      expect(result.meta.total).toBe(25);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
    });

    it('마지막 페이지를 올바르게 처리해야 함', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

      const result = service.paginateArray(items, { page: 3, limit: 10 });

      expect(result.data).toHaveLength(5);
      expect(result.meta.hasNext).toBe(false);
    });

    it('빈 배열을 처리해야 함', () => {
      const result = service.paginateArray([], { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(false);
    });
  });
});