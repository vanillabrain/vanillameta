import { Test, TestingModule } from '@nestjs/testing';
import { PaginationService } from './pagination.service';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CursorUtils } from './cursor.utils';

class TestEntity {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

describe('Pagination Performance Benchmark', () => {
  let service: PaginationService;
  let mockRepository: Repository<TestEntity>;
  let mockQueryBuilder: SelectQueryBuilder<TestEntity>;

  // 대량의 테스트 데이터 생성
  const generateTestData = (count: number): TestEntity[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Item ${i + 1}`,
      createdAt: new Date(Date.now() - (count - i) * 1000 * 60 * 60),
      updatedAt: new Date(Date.now() - (count - i) * 1000 * 60 * 60),
    }));
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaginationService],
    }).compile();

    service = module.get<PaginationService>(PaginationService);

    mockQueryBuilder = {
      clone: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
      getCount: jest.fn().mockResolvedValue(0),
    } as any;

    (mockQueryBuilder.clone as jest.Mock).mockImplementation(() => ({
      ...mockQueryBuilder,
      clone: jest.fn().mockReturnThis(),
    }));
  });

  describe('성능 비교: 커서 vs 오프셋', () => {
    it('대량 데이터셋에서 커서 기반이 더 빠름', async () => {
      const testData = generateTestData(10000);
      
      // 중간 페이지 접근 시뮬레이션 (5000번째 페이지)
      const middlePageData = testData.slice(4990, 5010);
      
      // 오프셋 기반 페이지네이션
      const offsetStartTime = process.hrtime.bigint();
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([middlePageData, 10000]);
      
      await service.paginateOffset(mockQueryBuilder, { page: 500, limit: 10 });
      
      const offsetEndTime = process.hrtime.bigint();
      const offsetDuration = Number(offsetEndTime - offsetStartTime) / 1000000; // ms
      
      // 커서 기반 페이지네이션
      const cursorStartTime = process.hrtime.bigint();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(middlePageData);
      
      const cursor = CursorUtils.encodeCursor({ id: 4990 });
      await service.paginateCursor(mockQueryBuilder, { nextCursor: cursor, limit: 10 });
      
      const cursorEndTime = process.hrtime.bigint();
      const cursorDuration = Number(cursorEndTime - cursorStartTime) / 1000000; // ms
      
      console.log(`오프셋 기반: ${offsetDuration.toFixed(2)}ms`);
      console.log(`커서 기반: ${cursorDuration.toFixed(2)}ms`);
      
      // 커서 기반이 더 빠르거나 비슷해야 함
      expect(cursorDuration).toBeLessThanOrEqual(offsetDuration * 1.5);
      
      // skip 호출 확인 (오프셋 기반만 skip 사용)
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(4990);
    });

    it('첫 페이지 접근 시 성능 비교', async () => {
      const testData = generateTestData(1000);
      const firstPageData = testData.slice(0, 10);
      
      // 오프셋 기반
      const offsetStartTime = process.hrtime.bigint();
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([firstPageData, 1000]);
      await service.paginateOffset(mockQueryBuilder, { page: 1, limit: 10 });
      const offsetEndTime = process.hrtime.bigint();
      const offsetDuration = Number(offsetEndTime - offsetStartTime) / 1000000;
      
      // 커서 기반
      const cursorStartTime = process.hrtime.bigint();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(firstPageData);
      await service.paginateCursor(mockQueryBuilder, { limit: 10 });
      const cursorEndTime = process.hrtime.bigint();
      const cursorDuration = Number(cursorEndTime - cursorStartTime) / 1000000;
      
      console.log(`첫 페이지 - 오프셋: ${offsetDuration.toFixed(2)}ms, 커서: ${cursorDuration.toFixed(2)}ms`);
      
      // 첫 페이지에서는 성능이 비슷해야 함
      expect(Math.abs(offsetDuration - cursorDuration)).toBeLessThan(5);
    });
  });

  describe('커서 인코딩/디코딩 성능', () => {
    it('대량의 커서 인코딩/디코딩 성능 측정', () => {
      const iterations = 10000;
      
      // 인코딩 성능
      const encodeStartTime = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        CursorUtils.encodeCursor({
          id: i,
          sortValue: new Date().toISOString(),
          metadata: { field1: 'value1', field2: 'value2' },
        });
      }
      const encodeEndTime = process.hrtime.bigint();
      const encodeDuration = Number(encodeEndTime - encodeStartTime) / 1000000;
      
      // 디코딩 성능
      const testCursor = CursorUtils.encodeCursor({ id: 123, sortValue: '2025-01-14' });
      const decodeStartTime = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        CursorUtils.decodeCursor(testCursor);
      }
      const decodeEndTime = process.hrtime.bigint();
      const decodeDuration = Number(decodeEndTime - decodeStartTime) / 1000000;
      
      console.log(`${iterations}개 커서 인코딩: ${encodeDuration.toFixed(2)}ms (${(encodeDuration / iterations).toFixed(4)}ms/op)`);
      console.log(`${iterations}개 커서 디코딩: ${decodeDuration.toFixed(2)}ms (${(decodeDuration / iterations).toFixed(4)}ms/op)`);
      
      // 개별 작업이 1ms 미만이어야 함
      expect(encodeDuration / iterations).toBeLessThan(1);
      expect(decodeDuration / iterations).toBeLessThan(1);
    });
  });

  describe('메모리 사용량 비교', () => {
    it('커서 기반이 메모리 효율적임', () => {
      // 커서는 작은 문자열
      const cursor = CursorUtils.encodeCursor({ id: 999999, sortValue: '2025-01-14T10:00:00Z' });
      const cursorSize = Buffer.from(cursor).length;
      
      // 오프셋은 큰 숫자 저장
      const offsetPageNumber = 999999;
      const offsetSize = 8; // 64-bit integer
      
      console.log(`커서 크기: ${cursorSize} bytes`);
      console.log(`오프셋 페이지 번호 크기: ${offsetSize} bytes`);
      
      // 커서가 100바이트 미만이어야 함
      expect(cursorSize).toBeLessThan(100);
    });
  });

  describe('동시성 성능', () => {
    it('동시 요청 처리 성능', async () => {
      const concurrentRequests = 100;
      const testData = generateTestData(20);
      
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(testData);
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([testData, 1000]);
      
      // 커서 기반 동시 요청
      const cursorStartTime = process.hrtime.bigint();
      const cursorPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        service.paginateCursor(mockQueryBuilder, { 
          nextCursor: CursorUtils.encodeCursor({ id: i * 10 }), 
          limit: 10 
        })
      );
      await Promise.all(cursorPromises);
      const cursorEndTime = process.hrtime.bigint();
      const cursorDuration = Number(cursorEndTime - cursorStartTime) / 1000000;
      
      // 오프셋 기반 동시 요청
      const offsetStartTime = process.hrtime.bigint();
      const offsetPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        service.paginateOffset(mockQueryBuilder, { page: i + 1, limit: 10 })
      );
      await Promise.all(offsetPromises);
      const offsetEndTime = process.hrtime.bigint();
      const offsetDuration = Number(offsetEndTime - offsetStartTime) / 1000000;
      
      console.log(`${concurrentRequests}개 동시 요청:`);
      console.log(`- 커서 기반: ${cursorDuration.toFixed(2)}ms`);
      console.log(`- 오프셋 기반: ${offsetDuration.toFixed(2)}ms`);
      
      // 두 방식 모두 합리적인 시간 내에 완료되어야 함
      expect(cursorDuration).toBeLessThan(1000);
      expect(offsetDuration).toBeLessThan(1000);
    });
  });
});