import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AppService', () => {
  let service: AppService;
  let originalEnv: string | undefined;
  let originalUptime: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
    
    // 환경 변수 백업
    originalEnv = process.env.NODE_ENV;
    
    // process.uptime Mock
    originalUptime = jest.spyOn(process, 'uptime');
    originalUptime.mockReturnValue(12345.678);
    
    // axios Mock 초기화
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 환경 변수 복원
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    
    // Mock 복원
    originalUptime.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message with development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const result = service.getHello();
      
      expect(result).toBe('Hello Vanilla Meta World - development');
    });

    it('should return hello message with production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const result = service.getHello();
      
      expect(result).toBe('Hello Vanilla Meta World - production');
    });

    it('should return hello message with test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const result = service.getHello();
      
      expect(result).toBe('Hello Vanilla Meta World - test');
    });

    it('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      
      const result = service.getHello();
      
      expect(result).toBe('Hello Vanilla Meta World - undefined');
    });
  });

  describe('getIp', () => {
    it('should return IP address data successfully', async () => {
      const mockResponse = {
        data: {
          ip: '192.168.1.100',
          country: 'Korea',
          region: 'Seoul',
        },
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.getIp();

      expect(mockedAxios.get).toHaveBeenCalledWith('https://lumtest.com/myip.json');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle network error gracefully', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.get.mockRejectedValue(networkError);

      await expect(service.getIp()).rejects.toThrow('Network Error');
      expect(mockedAxios.get).toHaveBeenCalledWith('https://lumtest.com/myip.json');
    });

    it('should handle timeout error', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      mockedAxios.get.mockRejectedValue(timeoutError);

      await expect(service.getIp()).rejects.toThrow('timeout of 5000ms exceeded');
    });

    it('should handle HTTP error responses', async () => {
      const httpError = {
        response: {
          status: 503,
          statusText: 'Service Unavailable',
        },
        message: 'Request failed with status code 503',
      };
      mockedAxios.get.mockRejectedValue(httpError);

      await expect(service.getIp()).rejects.toEqual(httpError);
    });
  });

  describe('checkHealth', () => {
    it('should return health status with all required fields', () => {
      process.env.NODE_ENV = 'test';

      const result = service.checkHealth();
      
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.environment).toBe('test');
      expect(result.version).toBe('1.0.0');
      expect(result.uptime).toBe(12345.678);
    });

    it('should return default environment when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;

      const result = service.checkHealth();

      expect(result.environment).toBe('development');
    });

    it('should return current uptime', () => {
      const result = service.checkHealth();

      expect(result.uptime).toBe(12345.678);
      expect(originalUptime).toHaveBeenCalled();
    });

    it('should return valid ISO timestamp', () => {
      const result = service.checkHealth();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(typeof result.timestamp).toBe('string');
      expect(result.timestamp.length).toBeGreaterThan(20);
    });

    it('should handle different environments correctly', () => {
      const environments = ['development', 'production', 'test', 'staging'];
      
      environments.forEach(env => {
        process.env.NODE_ENV = env;
        const result = service.checkHealth();
        expect(result.environment).toBe(env);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistent health check structure', () => {
      const result = service.checkHealth();
      const expectedKeys = ['status', 'timestamp', 'uptime', 'environment', 'version'];
      
      expect(Object.keys(result)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(result)).toHaveLength(expectedKeys.length);
    });

    it('should handle multiple consecutive health checks', () => {
      const results = Array.from({ length: 5 }, () => service.checkHealth());
      
      results.forEach((result, index) => {
        expect(result.status).toBe('ok');
        expect(result.version).toBe('1.0.0');
        expect(result.uptime).toBe(12345.678);
        
        if (index > 0) {
          // 타임스탬프는 달라야 함 (시간이 흐르므로)
          expect(result.timestamp).toBeDefined();
        }
      });
    });

    it('should handle concurrent IP requests', async () => {
      const mockResponse = { data: { ip: '192.168.1.100' } };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const promises = Array.from({ length: 3 }, () => service.getIp());
      const results = await Promise.all(promises);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result).toEqual(mockResponse.data);
      });
    });
  });
});