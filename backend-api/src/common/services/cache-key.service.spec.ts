import { Test, TestingModule } from '@nestjs/testing';
import { CacheKeyService } from './cache-key.service';
import { Request } from 'express';

describe('CacheKeyService', () => {
  let service: CacheKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheKeyService],
    }).compile();

    service = module.get<CacheKeyService>(CacheKeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKey', () => {
    const mockRequest = {
      method: 'GET',
      path: '/api/dashboards/1',
      query: {},
      headers: {},
      user: null,
    } as unknown as Request;

    it('should generate basic cache key', () => {
      const key = service.generateKey(mockRequest, {});
      expect(key).toBe('get:/api/dashboards/1');
    });

    it('should include prefix when provided', () => {
      const key = service.generateKey(mockRequest, { prefix: 'api' });
      expect(key).toBe('api:get:/api/dashboards/1');
    });

    it('should include version when provided', () => {
      const key = service.generateKey(mockRequest, { version: 2 });
      expect(key).toBe('v2:get:/api/dashboards/1');
    });

    it('should include user ID when userSpecific is true', () => {
      const userRequest = {
        ...mockRequest,
        user: { id: 123 },
      } as unknown as Request;

      const key = service.generateKey(userRequest, { userSpecific: true });
      expect(key).toBe('user:123:get:/api/dashboards/1');
    });

    it('should handle anonymous users', () => {
      const key = service.generateKey(mockRequest, { userSpecific: true });
      expect(key).toBe('user:anonymous:get:/api/dashboards/1');
    });

    it('should include all query parameters when includeQuery is true', () => {
      const requestWithQuery = {
        ...mockRequest,
        query: { sort: 'name', limit: '10', page: '1' },
      } as unknown as Request;

      const key = service.generateKey(requestWithQuery, { includeQuery: true });
      expect(key).toContain('query:limit=10&page=1&sort=name');
    });

    it('should include specific query parameters', () => {
      const requestWithQuery = {
        ...mockRequest,
        query: { sort: 'name', limit: '10', page: '1', debug: 'true' },
      } as unknown as Request;

      const key = service.generateKey(requestWithQuery, {
        includeQuery: ['sort', 'limit'],
      });
      expect(key).toContain('query:limit=10&sort=name');
      expect(key).not.toContain('page');
      expect(key).not.toContain('debug');
    });

    it('should handle array query parameters', () => {
      const requestWithArrayQuery = {
        ...mockRequest,
        query: { tags: ['tag1', 'tag2', 'tag3'] },
      } as unknown as Request;

      const key = service.generateKey(requestWithArrayQuery, {
        includeQuery: true,
      });
      expect(key).toContain('query:tags=tag1,tag2,tag3');
    });

    it('should include headers when specified', () => {
      const requestWithHeaders = {
        ...mockRequest,
        headers: {
          'x-api-version': 'v2',
          'accept-language': 'ko-KR',
          'user-agent': 'Mozilla/5.0',
        },
      } as unknown as Request;

      const key = service.generateKey(requestWithHeaders, {
        includeHeaders: ['x-api-version', 'accept-language'],
      });
      expect(key).toContain('headers:x-api-version=v2&accept-language=ko-KR');
      expect(key).not.toContain('user-agent');
    });

    it('should normalize paths', () => {
      const requestWithSlashes = {
        ...mockRequest,
        path: '/api//dashboards///1/',
      } as unknown as Request;

      const key = service.generateKey(requestWithSlashes, {});
      expect(key).toBe('get:/api/dashboards/1');
    });

    it('should hash long keys', () => {
      const longPath = '/api/very/long/path/'.repeat(20);
      const requestWithLongPath = {
        ...mockRequest,
        path: longPath,
      } as unknown as Request;

      const key = service.generateKey(requestWithLongPath, {
        prefix: 'test',
        version: 1,
      });

      expect(key.length).toBeLessThan(200);
      expect(key).toMatch(/^test:v1:hash:[a-f0-9]{16}$/);
    });
  });

  describe('generatePattern', () => {
    it('should generate pattern with parameters', () => {
      const pattern = service.generatePattern('dashboard:{id}:widget:{widgetId}', {
        id: 123,
        widgetId: 456,
      });
      expect(pattern).toBe('dashboard:123:widget:456');
    });

    it('should replace unmatched parameters with wildcards', () => {
      const pattern = service.generatePattern('dashboard:{id}:widget:{widgetId}', {
        id: 123,
      });
      expect(pattern).toBe('dashboard:123:widget:*');
    });
  });

  describe('specific key generators', () => {
    it('should generate dashboard key', () => {
      const key = service.generateDashboardKey(123);
      expect(key).toBe('dashboard:123:metadata');
    });

    it('should generate dashboard key with custom type', () => {
      const key = service.generateDashboardKey(123, 'widgets');
      expect(key).toBe('dashboard:123:widgets');
    });

    it('should generate dataset key', () => {
      const key = service.generateDatasetKey(456);
      expect(key).toBe('dataset:456');
    });

    it('should generate dataset key with query hash', () => {
      const key = service.generateDatasetKey(456, 'abc123');
      expect(key).toBe('dataset:456:query:abc123');
    });

    it('should generate widget key', () => {
      const key = service.generateWidgetKey(123, 789);
      expect(key).toBe('dashboard:123:widget:789');
    });

    it('should generate user key', () => {
      const key = service.generateUserKey(111, 'dashboards');
      expect(key).toBe('user:111:dashboards');
    });
  });
});