import { BadRequestException } from '@nestjs/common';
import { CursorUtils } from './cursor.utils';
import { CursorData } from './pagination.interface';

describe('CursorUtils', () => {
  describe('encodeCursor', () => {
    it('정상적인 커서 데이터를 Base64로 인코딩해야 함', () => {
      const cursorData: CursorData = {
        id: 123,
        sortValue: '2025-01-14T10:00:00Z',
        metadata: { field: 'value' },
      };

      const encoded = CursorUtils.encodeCursor(cursorData);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');

      // Base64 디코딩 후 원본 데이터 확인
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
      expect(decoded).toEqual(cursorData);
    });

    it('최소한의 커서 데이터만으로도 인코딩 가능해야 함', () => {
      const cursorData: CursorData = { id: 456 };
      const encoded = CursorUtils.encodeCursor(cursorData);
      expect(encoded).toBeDefined();
    });
  });

  describe('decodeCursor', () => {
    it('정상적인 Base64 커서를 디코딩해야 함', () => {
      const originalData: CursorData = {
        id: 789,
        sortValue: '2025-01-14',
      };
      const encoded = CursorUtils.encodeCursor(originalData);
      const decoded = CursorUtils.decodeCursor(encoded);

      expect(decoded).toEqual(originalData);
    });

    it('빈 커서는 null을 반환해야 함', () => {
      expect(CursorUtils.decodeCursor('')).toBeNull();
      expect(CursorUtils.decodeCursor(null)).toBeNull();
      expect(CursorUtils.decodeCursor(undefined)).toBeNull();
    });

    it('유효하지 않은 커서는 BadRequestException을 던져야 함', () => {
      expect(() => CursorUtils.decodeCursor('invalid-base64')).toThrow(BadRequestException);
      expect(() => CursorUtils.decodeCursor('aW52YWxpZA==')).toThrow(BadRequestException); // "invalid"의 base64
    });

    it('id가 없는 커서는 BadRequestException을 던져야 함', () => {
      const invalidData = { sortValue: 'test' };
      const encoded = Buffer.from(JSON.stringify(invalidData)).toString('base64url');

      expect(() => CursorUtils.decodeCursor(encoded)).toThrow(BadRequestException);
    });
  });

  describe('createCursorFromEntity', () => {
    it('엔티티에서 커서를 생성해야 함', () => {
      const entity = {
        id: 100,
        title: 'Test Entity',
        createdAt: new Date('2025-01-14'),
        updatedAt: new Date('2025-01-14'),
      };

      const cursor = CursorUtils.createCursorFromEntity(entity, 'createdAt');
      expect(cursor).toBeDefined();

      const decoded = CursorUtils.decodeCursor(cursor);
      expect(decoded.id).toBe(100);
      expect(decoded.sortValue).toEqual(entity.createdAt.toISOString());
    });

    it('추가 필드를 메타데이터에 포함해야 함', () => {
      const entity = {
        id: 200,
        title: 'Test',
        priority: 'high',
        status: 'active',
      };

      const cursor = CursorUtils.createCursorFromEntity(entity, 'id', ['priority', 'status']);
      const decoded = CursorUtils.decodeCursor(cursor);

      expect(decoded.metadata).toEqual({
        priority: 'high',
        status: 'active',
      });
    });

    it('null 엔티티는 null을 반환해야 함', () => {
      expect(CursorUtils.createCursorFromEntity(null)).toBeNull();
      expect(CursorUtils.createCursorFromEntity(undefined)).toBeNull();
    });
  });

  describe('createCursorsFromEntities', () => {
    it('엔티티 배열에서 다음/이전 커서를 생성해야 함', () => {
      const entities = [
        { id: 1, title: 'First', createdAt: new Date('2025-01-01') },
        { id: 2, title: 'Second', createdAt: new Date('2025-01-02') },
        { id: 3, title: 'Third', createdAt: new Date('2025-01-03') },
      ];

      const result = CursorUtils.createCursorsFromEntities(entities, 3, 'createdAt');

      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
      expect(result.nextCursor).toBeUndefined();
      expect(result.previousCursor).toBeDefined();
    });

    it('limit보다 많은 엔티티가 있으면 hasNext를 true로 설정해야 함', () => {
      const entities = [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' },
        { id: 3, title: 'Third' },
        { id: 4, title: 'Fourth' },
      ];

      const result = CursorUtils.createCursorsFromEntities(entities, 3);

      expect(result.hasNext).toBe(true);
      expect(result.nextCursor).toBeDefined();

      const nextCursorData = CursorUtils.decodeCursor(result.nextCursor);
      expect(nextCursorData.id).toBe(3); // 마지막 표시된 아이템
    });

    it('빈 배열은 커서 없이 반환해야 함', () => {
      const result = CursorUtils.createCursorsFromEntities([], 10);

      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
      expect(result.nextCursor).toBeUndefined();
      expect(result.previousCursor).toBeUndefined();
    });
  });

  describe('validateCursor', () => {
    it('유효한 커서는 true를 반환해야 함', () => {
      const cursorData: CursorData = { id: 123 };
      const cursor = CursorUtils.encodeCursor(cursorData);

      expect(CursorUtils.validateCursor(cursor)).toBe(true);
    });

    it('유효하지 않은 커서는 false를 반환해야 함', () => {
      expect(CursorUtils.validateCursor('invalid')).toBe(false);
      expect(CursorUtils.validateCursor('')).toBe(false);
    });

    it('만료된 커서는 false를 반환해야 함', () => {
      // Use real Date constructor to create a timestamp 2 hours ago
      const realDate = Date;
      const currentTime = realDate.now();
      const oldTimestamp = new (realDate as any)(currentTime - 2 * 60 * 60 * 1000).toISOString();

      const cursorData: CursorData = {
        id: 123,
        metadata: { timestamp: oldTimestamp },
      };
      const cursor = CursorUtils.encodeCursor(cursorData);

      const result = CursorUtils.validateCursor(cursor, 3600);
      expect(result).toBe(false); // 1시간 제한
    });

    it('유효 기간 내의 커서는 true를 반환해야 함', () => {
      // Use real Date constructor to create a timestamp 30 minutes ago
      const realDate = Date;
      const currentTime = realDate.now();
      const recentTimestamp = new (realDate as any)(currentTime - 30 * 60 * 1000).toISOString();

      const cursorData: CursorData = {
        id: 123,
        metadata: { timestamp: recentTimestamp },
      };
      const cursor = CursorUtils.encodeCursor(cursorData);

      expect(CursorUtils.validateCursor(cursor, 3600)).toBe(true); // 1시간 제한
    });
  });

  describe('buildCursorWhereClause', () => {
    it('단순 ID 기반 WHERE 조건을 생성해야 함', () => {
      const cursor = CursorUtils.encodeCursor({ id: 100 });
      const result = CursorUtils.buildCursorWhereClause(cursor, 'id', 'DESC');

      expect(result.condition).toBe('id < :cursorId');
      expect(result.parameters).toEqual({ cursorId: 100 });
    });

    it('복합 정렬 조건을 생성해야 함', () => {
      const cursor = CursorUtils.encodeCursor({
        id: 200,
        sortValue: '2025-01-14',
      });
      const result = CursorUtils.buildCursorWhereClause(cursor, 'createdAt', 'DESC', 'w');

      expect(result.condition).toContain('w.createdAt < :sortValue');
      expect(result.condition).toContain('w.id < :cursorId');
      expect(result.parameters).toEqual({
        sortValue: '2025-01-14',
        cursorId: 200,
      });
    });

    it('ASC 정렬에서는 > 연산자를 사용해야 함', () => {
      const cursor = CursorUtils.encodeCursor({ id: 300 });
      const result = CursorUtils.buildCursorWhereClause(cursor, 'id', 'ASC');

      expect(result.condition).toBe('id > :cursorId');
    });

    it('빈 커서는 빈 조건을 반환해야 함', () => {
      const result = CursorUtils.buildCursorWhereClause('', 'id');

      expect(result.condition).toBe('');
      expect(result.parameters).toEqual({});
    });

    it('별칭을 포함한 조건을 생성해야 함', () => {
      const cursor = CursorUtils.encodeCursor({ id: 400 });
      const result = CursorUtils.buildCursorWhereClause(cursor, 'id', 'DESC', 'widget');

      expect(result.condition).toBe('widget.id < :cursorId');
    });
  });
});
