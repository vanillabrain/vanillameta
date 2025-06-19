import { eventTracker } from './eventTracker';
import { EventAction, EventCategory } from './eventTypes';
import apiHelper from '@/helpers/apiHelper';

// Mock apiHelper
jest.mock('@/helpers/apiHelper', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock navigator
Object.defineProperty(window.navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-1234'),
} as any;

describe('EventTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorageMock.getItem.mockReturnValue(null);
    sessionStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('세션 관리', () => {
    it('새로운 세션 ID를 생성해야 함', () => {
      // EventTracker 초기화로 세션 ID가 생성됨
      eventTracker; // 싱글톤 인스턴스 접근
      
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'vanillameta_session_id',
        'test-uuid-1234'
      );
    });

    it('기존 세션 ID를 재사용해야 함', () => {
      sessionStorageMock.getItem.mockReturnValueOnce('existing-session-id');
      
      // EventTracker는 싱글톤이므로 새 인스턴스를 만들 수 없음
      // 대신 세션 정보를 확인
      eventTracker; // 싱글톤 인스턴스 접근
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('vanillameta_session_id');
    });
  });

  describe('프라이버시 설정', () => {
    it('동의가 없으면 이벤트를 추적하지 않아야 함', () => {
      localStorageMock.getItem.mockReturnValue('false');
      
      eventTracker.setPrivacySettings({ consentGiven: false });
      eventTracker.track(
        EventAction.DASHBOARD_CREATED,
        EventCategory.DASHBOARD,
        { dashboardId: 'test-123' }
      );

      expect(apiHelper.post).not.toHaveBeenCalled();
    });

    it('동의가 있으면 이벤트를 추적해야 함', () => {
      eventTracker.setPrivacySettings({ consentGiven: true });
      eventTracker.track(
        EventAction.DASHBOARD_CREATED,
        EventCategory.DASHBOARD,
        { dashboardId: 'test-123' }
      );

      // 이벤트가 큐에 추가됨 (즉시 전송되지 않음)
      expect(apiHelper.post).not.toHaveBeenCalled();
      
      // 플러시 인터벌 후 전송됨
      jest.advanceTimersByTime(30000);
      expect(apiHelper.post).toHaveBeenCalled();
    });
  });

  describe('이벤트 추적', () => {
    beforeEach(() => {
      eventTracker.setPrivacySettings({ consentGiven: true });
    });

    it('이벤트를 큐에 추가해야 함', () => {
      eventTracker.track(
        EventAction.WIDGET_CREATED,
        EventCategory.WIDGET,
        {
          widgetId: 'widget-123',
          chartType: 'bar',
        },
        'bar-chart',
        1
      );

      // 배치 크기에 도달하지 않았으므로 즉시 전송되지 않음
      expect(apiHelper.post).not.toHaveBeenCalled();
    });

    it('배치 크기에 도달하면 즉시 전송해야 함', () => {
      // 50개의 이벤트 추가 (maxBatchSize = 50)
      for (let i = 0; i < 50; i++) {
        eventTracker.track(
          EventAction.DASHBOARD_VIEWED,
          EventCategory.DASHBOARD,
          { dashboardId: `dash-${i}` }
        );
      }

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              action: EventAction.DASHBOARD_VIEWED,
              category: EventCategory.DASHBOARD,
            }),
          ]),
        })
      );
    });
  });

  describe('PII 제거', () => {
    beforeEach(() => {
      eventTracker.setPrivacySettings({ 
        consentGiven: true,
        excludePII: true
      });
    });

    it('민감한 정보를 제거해야 함', () => {
      eventTracker.track(
        EventAction.USER_PROFILE_UPDATED,
        EventCategory.USER,
        {
          userId: 'user-123',
          email: 'user@example.com',
          phone: '123-456-7890',
          name: 'John Doe',
          dashboardCount: 5,
        }
      );

      jest.advanceTimersByTime(30000); // 플러시 인터벌

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              properties: expect.not.objectContaining({
                email: expect.any(String),
                phone: expect.any(String),
                name: expect.any(String),
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('성능 추적', () => {
    beforeEach(() => {
      eventTracker.setPrivacySettings({ consentGiven: true });
    });

    it('성능 메트릭을 추적해야 함', () => {
      eventTracker.trackPerformance({
        name: 'page_load_dashboard',
        value: 1234.56,
        category: 'page_performance',
      });

      jest.advanceTimersByTime(30000);

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/metrics',
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'page_load_dashboard',
              value: 1234.56,
              category: 'page_performance',
            }),
          ]),
        })
      );
    });

    it('타이밍을 추적해야 함', () => {
      const startTime = Date.now() - 1500; // 1.5초 전
      eventTracker.trackTiming('api_call', startTime, 'api_performance');

      jest.advanceTimersByTime(30000);

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/metrics',
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'api_call',
              value: expect.any(Number), // 약 1500
              category: 'api_performance',
            }),
          ]),
        })
      );
    });
  });

  describe('오프라인 지원', () => {
    it('오프라인일 때 이벤트를 로컬 스토리지에 저장해야 함', () => {
      Object.defineProperty(window.navigator, 'onLine', { value: false });
      
      eventTracker.setPrivacySettings({ consentGiven: true });
      eventTracker.track(
        EventAction.DASHBOARD_CREATED,
        EventCategory.DASHBOARD,
        { dashboardId: 'dash-123' }
      );

      // 오프라인이므로 API 호출되지 않음
      jest.advanceTimersByTime(30000);
      expect(apiHelper.post).not.toHaveBeenCalled();
      
      // 대신 로컬 스토리지에 저장됨
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vanillameta_event_queue',
        expect.any(String)
      );
    });

    it('온라인으로 전환 시 저장된 이벤트를 전송해야 함', () => {
      const storedEvents = {
        events: [{
          action: EventAction.DASHBOARD_CREATED,
          category: EventCategory.DASHBOARD,
          properties: { dashboardId: 'dash-123' },
        }],
        metrics: [],
        lastFlushTime: Date.now(),
      };
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedEvents));
      Object.defineProperty(window.navigator, 'onLine', { value: true });
      
      // online 이벤트 발생
      window.dispatchEvent(new Event('online'));

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              action: EventAction.DASHBOARD_CREATED,
            }),
          ]),
        })
      );
    });
  });

  describe('사용자 설정', () => {
    it('사용자 정보를 설정해야 함', () => {
      eventTracker.setPrivacySettings({ consentGiven: true });
      eventTracker.setUser('user-123', {
        email: 'user@example.com',
        role: 'admin',
      });

      eventTracker.track(
        EventAction.DASHBOARD_CREATED,
        EventCategory.DASHBOARD
      );

      jest.advanceTimersByTime(30000);

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              properties: expect.objectContaining({
                userId: 'user-123',
              }),
            }),
          ]),
        })
      );
    });

    it('사용자 정보를 초기화해야 함', () => {
      eventTracker.setPrivacySettings({ consentGiven: true });
      eventTracker.setUser('user-123');
      eventTracker.clearUser();

      eventTracker.track(
        EventAction.DASHBOARD_CREATED,
        EventCategory.DASHBOARD
      );

      jest.advanceTimersByTime(30000);

      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              properties: expect.not.objectContaining({
                userId: expect.any(String),
              }),
            }),
          ]),
        })
      );
    });
  });
});