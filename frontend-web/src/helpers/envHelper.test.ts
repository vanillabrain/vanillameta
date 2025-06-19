import {
  getApiUrl,
  getAppMode,
  isDevelopment,
  isProduction,
  isLocal,
  getEnvVar,
  getEnvConfig,
  isDebugMode,
  envLog,
} from './envHelper';

describe('환경 변수 헬퍼 함수 테스트', () => {
  // 원본 환경 변수 저장
  const originalEnv = process.env;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // 환경 변수 초기화
    jest.resetModules();
    process.env = { ...originalEnv };
    console.log = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
  });

  describe('getApiUrl', () => {
    it('환경 변수가 설정되어 있으면 해당 값을 반환해야 함', () => {
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      expect(getApiUrl()).toBe('https://api.example.com');
    });

    it('환경 변수가 없으면 기본값을 반환해야 함', () => {
      delete process.env.REACT_APP_API_URL;
      expect(getApiUrl()).toBe('http://localhost:3000');
    });
  });

  describe('getAppMode', () => {
    it('환경 변수가 설정되어 있으면 해당 값을 반환해야 함', () => {
      process.env.REACT_APP_MODE = 'prod';
      expect(getAppMode()).toBe('prod');
    });

    it('환경 변수가 없으면 local을 반환해야 함', () => {
      delete process.env.REACT_APP_MODE;
      expect(getAppMode()).toBe('local');
    });
  });

  describe('isDevelopment', () => {
    it('NODE_ENV가 development면 true를 반환해야 함', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('REACT_APP_MODE가 dev면 true를 반환해야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_MODE = 'dev';
      expect(isDevelopment()).toBe(true);
    });

    it('둘 다 아니면 false를 반환해야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_MODE = 'prod';
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('isProduction', () => {
    it('NODE_ENV가 production이면 true를 반환해야 함', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('REACT_APP_MODE가 prod면 true를 반환해야 함', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_MODE = 'prod';
      expect(isProduction()).toBe(true);
    });

    it('둘 다 아니면 false를 반환해야 함', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_MODE = 'dev';
      expect(isProduction()).toBe(false);
    });
  });

  describe('isLocal', () => {
    it('REACT_APP_MODE가 local이면 true를 반환해야 함', () => {
      process.env.REACT_APP_MODE = 'local';
      expect(isLocal()).toBe(true);
    });

    it('REACT_APP_MODE가 local이 아니면 false를 반환해야 함', () => {
      process.env.REACT_APP_MODE = 'dev';
      expect(isLocal()).toBe(false);
    });

    it('REACT_APP_MODE가 없으면 true를 반환해야 함 (기본값)', () => {
      delete process.env.REACT_APP_MODE;
      expect(isLocal()).toBe(true);
    });
  });

  describe('getEnvVar', () => {
    it('환경 변수가 있으면 해당 값을 반환해야 함', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnvVar('TEST_VAR')).toBe('test_value');
    });

    it('환경 변수가 없으면 기본값을 반환해야 함', () => {
      expect(getEnvVar('NON_EXISTENT', 'default')).toBe('default');
    });

    it('기본값이 없으면 빈 문자열을 반환해야 함', () => {
      expect(getEnvVar('NON_EXISTENT')).toBe('');
    });
  });

  describe('getEnvConfig', () => {
    it('모든 환경 설정을 포함한 객체를 반환해야 함', () => {
      process.env.REACT_APP_API_URL = 'https://api.test.com';
      process.env.REACT_APP_MODE = 'dev';
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_GA_ID = 'GA-123456';
      process.env.REACT_APP_SENTRY_DSN = 'https://sentry.io/123';

      const config = getEnvConfig();

      expect(config).toEqual({
        apiUrl: 'https://api.test.com',
        mode: 'dev',
        isDevelopment: true,
        isProduction: false,
        isLocal: false,
        nodeEnv: 'development',
        googleAnalyticsId: 'GA-123456',
        sentryDsn: 'https://sentry.io/123',
      });
    });

    it('환경 변수가 없을 때도 기본값으로 작동해야 함', () => {
      delete process.env.REACT_APP_API_URL;
      delete process.env.REACT_APP_MODE;
      delete process.env.NODE_ENV;
      delete process.env.REACT_APP_GA_ID;
      delete process.env.REACT_APP_SENTRY_DSN;

      const config = getEnvConfig();

      expect(config).toEqual({
        apiUrl: 'http://localhost:3000',
        mode: 'local',
        isDevelopment: false,
        isProduction: false,
        isLocal: true,
        nodeEnv: undefined,
        googleAnalyticsId: undefined,
        sentryDsn: undefined,
      });
    });
  });

  describe('isDebugMode', () => {
    it('REACT_APP_DEBUG가 true면 true를 반환해야 함', () => {
      process.env.REACT_APP_DEBUG = 'true';
      expect(isDebugMode()).toBe(true);
    });

    it('REACT_APP_DEBUG가 true가 아니면 false를 반환해야 함', () => {
      process.env.REACT_APP_DEBUG = 'false';
      expect(isDebugMode()).toBe(false);
    });

    it('REACT_APP_DEBUG가 없으면 false를 반환해야 함', () => {
      delete process.env.REACT_APP_DEBUG;
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('envLog', () => {
    it('개발 환경에서는 로그를 출력해야 함', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_MODE = 'dev';

      envLog('테스트 메시지', { data: 'test' });

      expect(console.log).toHaveBeenCalledWith('[dev] 테스트 메시지', { data: 'test' });
    });

    it('프로덕션 환경에서는 로그를 출력하지 않아야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_MODE = 'prod';

      envLog('테스트 메시지');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('프로덕션이지만 디버그 모드면 로그를 출력해야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_MODE = 'prod';
      process.env.REACT_APP_DEBUG = 'true';

      envLog('디버그 메시지');

      expect(console.log).toHaveBeenCalledWith('[prod] 디버그 메시지');
    });

    it('로컬 환경에서는 로그를 출력해야 함', () => {
      delete process.env.NODE_ENV;
      process.env.REACT_APP_MODE = 'local';

      envLog('로컬 메시지', 1, 2, 3);

      expect(console.log).toHaveBeenCalledWith('[local] 로컬 메시지', 1, 2, 3);
    });
  });
});