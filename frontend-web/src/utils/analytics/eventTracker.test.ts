// Mock module before imports
jest.mock('@/helpers/apiHelper', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({}),
  },
}));

import { eventTracker } from './eventTracker';
import { EventAction, EventCategory } from './eventTypes';
import apiHelper from '@/helpers/apiHelper';

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
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
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

    // Reset localStorage/sessionStorage mock return values
    localStorageMock.getItem.mockImplementation(key => {
      if (key === 'vanillameta_analytics_consent') {
        return 'false'; // 기본값은 동의하지 않음
      }
      return null;
    });
    sessionStorageMock.getItem.mockReturnValue(null);

    // Clear any pending timers
    jest.clearAllTimers();

    // Reset EventTracker state
    (eventTracker as any).__resetForTesting();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('세션 관리', () => {
    it('새로운 세션 ID를 생성해야 함', () => {
      // sessionStorage.setItem이 호출되었는지 확인
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('vanillameta_session_id', expect.any(String));

      // 세션 정보도 저장되었는지 확인
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('vanillameta_session_info', expect.any(String));
    });

    it('기존 세션 ID를 재사용해야 함', () => {
      jest.clearAllMocks();
      sessionStorageMock.getItem.mockImplementation(key => {
        if (key === 'vanillameta_session_id') {
          return 'existing-session-id';
        }
        if (key === 'vanillameta_session_info') {
          return JSON.stringify({
            sessionId: 'existing-session-id',
            startTime: Date.now(),
            lastActivityTime: Date.now(),
            pageViews: 0,
            eventCount: 0,
          });
        }
        return null;
      });

      // EventTracker 리셋으로 세션 재사용 확인
      (eventTracker as any).__resetForTesting();

      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('vanillameta_session_id');
    });
  });

  describe('프라이버시 설정', () => {
    it('동의가 없으면 이벤트를 추적하지 않아야 함', () => {
      eventTracker.setPrivacySettings({ consentGiven: false });
      eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD, { dashboardId: 'test-123' });

      jest.advanceTimersByTime(30000);
      expect(apiHelper.post).not.toHaveBeenCalled();
    });

    it('동의가 있으면 이벤트를 추적해야 함', () => {
      eventTracker.setPrivacySettings({ consentGiven: true });
      eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD, { dashboardId: 'test-123' });

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
        1,
      );

      // 배치 크기에 도달하지 않았으므로 즉시 전송되지 않음
      expect(apiHelper.post).not.toHaveBeenCalled();
    });

    it('배치 크기에 도달하면 즉시 전송해야 함', () => {
      // 50개의 이벤트 추가 (maxBatchSize = 50)
      for (let i = 0; i < 50; i++) {
        eventTracker.track(EventAction.DASHBOARD_VIEWED, EventCategory.DASHBOARD, { dashboardId: `dash-${i}` });
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
        }),
      );
    });
  });

  describe('PII 제거', () => {
    beforeEach(() => {
      eventTracker.setPrivacySettings({
        consentGiven: true,
        excludePII: true,
      });
    });

    it('민감한 정보를 제거해야 함', () => {
      eventTracker.track(EventAction.USER_PROFILE_UPDATED, EventCategory.USER, {
        userId: 'user-123',
        email: 'user@example.com',
        phone: '123-456-7890',
        name: 'John Doe',
        dashboardCount: 5,
      });

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
        }),
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
        }),
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
        }),
      );
    });
  });

  describe('오프라인 지원', () => {
    it('오프라인일 때 이벤트를 로컬 스토리지에 저장해야 함', () => {
      // 오프라인 상태 설정
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // EventTracker 리셋하여 오프라인 상태 반영
      (eventTracker as any).__resetForTesting();
      (eventTracker as any).isOnline = false;

      eventTracker.setPrivacySettings({ consentGiven: true });

      // 이벤트 추가
      eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD, { dashboardId: 'dash-123' });

      // saveQueueToStorage 메서드 직접 호출 (오프라인 시 자동 저장 트리거)
      (eventTracker as any).saveQueueToStorage();

      // 오프라인이므로 API 호출되지 않음
      jest.advanceTimersByTime(30000);
      expect(apiHelper.post).not.toHaveBeenCalled();

      // 로컬 스토리지에 저장되었는지 확인
      const savedCalls = localStorageMock.setItem.mock.calls;
      const eventQueueCall = savedCalls.find(call => call[0] === 'vanillameta_event_queue');
      expect(eventQueueCall).toBeDefined();

      if (eventQueueCall) {
        const savedData = JSON.parse(eventQueueCall[1]);
        expect(savedData.events).toHaveLength(1);
        expect(savedData.events[0].action).toBe(EventAction.DASHBOARD_CREATED);
      }
    });

    it('온라인으로 전환 시 저장된 이벤트를 전송해야 함', async () => {
      const storedEvents = {
        events: [
          {
            action: EventAction.DASHBOARD_CREATED,
            category: EventCategory.DASHBOARD,
            properties: { dashboardId: 'dash-123' },
          },
        ],
        metrics: [],
        lastFlushTime: Date.now(),
      };

      // localStorage mock 설정
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'vanillameta_event_queue') {
          return JSON.stringify(storedEvents);
        }
        if (key === 'vanillameta_analytics_consent') {
          return 'true';
        }
        return null;
      });

      // 온라인 상태로 전환
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // EventTracker 리셋 및 온라인 상태 설정
      (eventTracker as any).__resetForTesting();
      (eventTracker as any).isOnline = true;

      // loadQueueFromStorage 메서드 직접 호출하여 저장된 이벤트 로드
      (eventTracker as any).loadQueueFromStorage();

      // flush 메서드 직접 호출
      await (eventTracker as any).flush();

      // API 호출 확인
      expect(apiHelper.post).toHaveBeenCalledWith(
        '/v1/events/track',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              action: EventAction.DASHBOARD_CREATED,
            }),
          ]),
        }),
      );

      // 로컬 스토리지에서 제거되었는지 확인
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vanillameta_event_queue');
    }, 10000); // 타임아웃 증가
  });

  describe('사용자 설정', () => {
    beforeEach(() => {
      eventTracker.setPrivacySettings({ consentGiven: true });
    });

    it('사용자 정보를 설정해야 함', () => {
      eventTracker.setUser('user-123', {
        email: 'user@example.com',
        role: 'admin',
      });

      eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD);

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
        }),
      );
    });

    it('사용자 정보를 초기화해야 함', () => {
      eventTracker.setUser('user-123');
      eventTracker.clearUser();

      eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD);

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
        }),
      );
    });
  });
});
