// 사용자 행동 분석 이벤트 추적 시스템

import { trackEvent, trackTiming } from './analytics';
import axios from 'axios';

// 이벤트 타입 정의
export enum EventCategory {
  DASHBOARD = 'dashboard',
  WIDGET = 'widget',
  DATA = 'data',
  USER = 'user',
  ONBOARDING = 'onboarding',
  PERFORMANCE = 'performance',
  ERROR = 'error'
}

export enum EventAction {
  // Dashboard actions
  DASHBOARD_CREATED = 'dashboard_created',
  DASHBOARD_VIEWED = 'dashboard_viewed',
  DASHBOARD_EDITED = 'dashboard_edited',
  DASHBOARD_DELETED = 'dashboard_deleted',
  DASHBOARD_SHARED = 'dashboard_shared',
  DASHBOARD_DUPLICATED = 'dashboard_duplicated',
  DASHBOARD_EXPORTED = 'dashboard_exported',
  
  // Widget actions
  WIDGET_CREATED = 'widget_created',
  WIDGET_EDITED = 'widget_edited',
  WIDGET_DELETED = 'widget_deleted',
  WIDGET_RESIZED = 'widget_resized',
  WIDGET_MOVED = 'widget_moved',
  WIDGET_DUPLICATED = 'widget_duplicated',
  
  // Data actions
  DATABASE_CONNECTED = 'database_connected',
  DATABASE_DISCONNECTED = 'database_disconnected',
  DATABASE_TEST_CONNECTION = 'database_test_connection',
  DATASET_CREATED = 'dataset_created',
  DATASET_EDITED = 'dataset_edited',
  DATASET_DELETED = 'dataset_deleted',
  QUERY_EXECUTED = 'query_executed',
  QUERY_FAILED = 'query_failed',
  
  // User actions
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  USER_PASSWORD_CHANGED = 'user_password_changed',
  
  // Onboarding actions
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_SKIPPED = 'onboarding_skipped',
  
  // Performance actions
  PAGE_LOAD_TIME = 'page_load_time',
  API_RESPONSE_TIME = 'api_response_time',
  CHART_RENDER_TIME = 'chart_render_time',
  
  // Error actions
  API_ERROR = 'api_error',
  RUNTIME_ERROR = 'runtime_error',
  VALIDATION_ERROR = 'validation_error'
}

// 이벤트 데이터 인터페이스
interface EventData {
  category: EventCategory;
  action: EventAction;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

// 이벤트 큐 관리
class EventQueue {
  private queue: EventData[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5초
  private timer: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;

  constructor() {
    // 온라인/오프라인 상태 감지
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // 페이지 떠날 때 남은 이벤트 전송
    window.addEventListener('beforeunload', () => {
      this.flush(true);
    });

    // 주기적으로 이벤트 전송
    this.startTimer();
  }

  add(event: EventData) {
    this.queue.push({
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || 'direct',
        url: window.location.href,
        sessionId: this.getSessionId()
      }
    });

    // 큐가 가득 찼으면 즉시 전송
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  private startTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(sync = false) {
    if (this.queue.length === 0 || !this.isOnline) {
      return;
    }

    const events = [...this.queue];
    this.queue = [];

    try {
      if (sync) {
        // 동기 요청 (페이지 떠날 때)
        navigator.sendBeacon('/api/v1/analytics/events', JSON.stringify({ events }));
      } else {
        // 비동기 요청
        await axios.post('/api/v1/analytics/events', { events });
      }
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // 실패한 이벤트는 다시 큐에 추가
      this.queue.unshift(...events);
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }
}

// 전역 이벤트 큐 인스턴스
const eventQueue = new EventQueue();

// 이벤트 추적 함수
export const trackUserEvent = (
  category: EventCategory,
  action: EventAction,
  label?: string,
  value?: number,
  metadata?: Record<string, any>
) => {
  // Google Analytics로 전송
  trackEvent(action, category, label, value);
  
  // 자체 백엔드로 전송
  eventQueue.add({
    category,
    action,
    label,
    value,
    metadata
  });
};

// 성능 측정 헬퍼
export const trackPerformance = (
  metricName: string,
  duration: number,
  metadata?: Record<string, any>
) => {
  trackTiming(metricName, duration, EventCategory.PERFORMANCE);
  
  trackUserEvent(
    EventCategory.PERFORMANCE,
    EventAction.API_RESPONSE_TIME,
    metricName,
    duration,
    metadata
  );
};

// 에러 추적 헬퍼
export const trackError = (
  errorType: 'api' | 'runtime' | 'validation',
  errorMessage: string,
  metadata?: Record<string, any>
) => {
  const action = {
    api: EventAction.API_ERROR,
    runtime: EventAction.RUNTIME_ERROR,
    validation: EventAction.VALIDATION_ERROR
  }[errorType];

  trackUserEvent(
    EventCategory.ERROR,
    action,
    errorMessage,
    undefined,
    metadata
  );
};

// 사용자 세션 추적
export const trackUserSession = {
  login: (method: string, userId: string) => {
    trackUserEvent(
      EventCategory.USER,
      EventAction.USER_LOGIN,
      method,
      undefined,
      { userId }
    );
  },
  
  logout: (userId: string) => {
    trackUserEvent(
      EventCategory.USER,
      EventAction.USER_LOGOUT,
      undefined,
      undefined,
      { userId }
    );
  },
  
  register: (method: string, userId: string) => {
    trackUserEvent(
      EventCategory.USER,
      EventAction.USER_REGISTERED,
      method,
      undefined,
      { userId }
    );
  }
};

// 대시보드 이벤트 추적
export const trackDashboardEvent = {
  created: (dashboardId: string, templateUsed?: string) => {
    trackUserEvent(
      EventCategory.DASHBOARD,
      EventAction.DASHBOARD_CREATED,
      templateUsed || 'blank',
      undefined,
      { dashboardId, templateUsed }
    );
  },
  
  viewed: (dashboardId: string, viewDuration?: number) => {
    trackUserEvent(
      EventCategory.DASHBOARD,
      EventAction.DASHBOARD_VIEWED,
      dashboardId,
      viewDuration,
      { dashboardId }
    );
  },
  
  edited: (dashboardId: string, changes: string[]) => {
    trackUserEvent(
      EventCategory.DASHBOARD,
      EventAction.DASHBOARD_EDITED,
      dashboardId,
      changes.length,
      { dashboardId, changes }
    );
  },
  
  deleted: (dashboardId: string) => {
    trackUserEvent(
      EventCategory.DASHBOARD,
      EventAction.DASHBOARD_DELETED,
      dashboardId,
      undefined,
      { dashboardId }
    );
  },
  
  shared: (dashboardId: string, shareMethod: string) => {
    trackUserEvent(
      EventCategory.DASHBOARD,
      EventAction.DASHBOARD_SHARED,
      shareMethod,
      undefined,
      { dashboardId, shareMethod }
    );
  }
};

// 위젯 이벤트 추적
export const trackWidgetEvent = {
  created: (widgetId: string, chartType: string, dashboardId: string) => {
    trackUserEvent(
      EventCategory.WIDGET,
      EventAction.WIDGET_CREATED,
      chartType,
      undefined,
      { widgetId, chartType, dashboardId }
    );
  },
  
  edited: (widgetId: string, changes: string[]) => {
    trackUserEvent(
      EventCategory.WIDGET,
      EventAction.WIDGET_EDITED,
      widgetId,
      changes.length,
      { widgetId, changes }
    );
  },
  
  deleted: (widgetId: string) => {
    trackUserEvent(
      EventCategory.WIDGET,
      EventAction.WIDGET_DELETED,
      widgetId,
      undefined,
      { widgetId }
    );
  },
  
  resized: (widgetId: string, newSize: { width: number; height: number }) => {
    trackUserEvent(
      EventCategory.WIDGET,
      EventAction.WIDGET_RESIZED,
      widgetId,
      undefined,
      { widgetId, ...newSize }
    );
  },
  
  moved: (widgetId: string, newPosition: { x: number; y: number }) => {
    trackUserEvent(
      EventCategory.WIDGET,
      EventAction.WIDGET_MOVED,
      widgetId,
      undefined,
      { widgetId, ...newPosition }
    );
  }
};

// 데이터 이벤트 추적
export const trackDataEvent = {
  databaseConnected: (databaseType: string, success: boolean, connectionId?: string) => {
    trackUserEvent(
      EventCategory.DATA,
      EventAction.DATABASE_CONNECTED,
      databaseType,
      success ? 1 : 0,
      { databaseType, success, connectionId }
    );
  },
  
  queryExecuted: (datasetId: string, executionTime: number, rowCount?: number) => {
    trackUserEvent(
      EventCategory.DATA,
      EventAction.QUERY_EXECUTED,
      datasetId,
      executionTime,
      { datasetId, executionTime, rowCount }
    );
  },
  
  queryFailed: (datasetId: string, errorMessage: string) => {
    trackUserEvent(
      EventCategory.DATA,
      EventAction.QUERY_FAILED,
      datasetId,
      undefined,
      { datasetId, errorMessage }
    );
  }
};

// 온보딩 이벤트 추적
export const trackOnboardingEvent = {
  started: () => {
    trackUserEvent(
      EventCategory.ONBOARDING,
      EventAction.ONBOARDING_STARTED
    );
  },
  
  stepCompleted: (stepName: string, stepNumber: number) => {
    trackUserEvent(
      EventCategory.ONBOARDING,
      EventAction.ONBOARDING_STEP_COMPLETED,
      stepName,
      stepNumber,
      { stepName, stepNumber }
    );
  },
  
  completed: (completedSteps: string[]) => {
    trackUserEvent(
      EventCategory.ONBOARDING,
      EventAction.ONBOARDING_COMPLETED,
      undefined,
      completedSteps.length,
      { completedSteps }
    );
  },
  
  skipped: (atStep: string) => {
    trackUserEvent(
      EventCategory.ONBOARDING,
      EventAction.ONBOARDING_SKIPPED,
      atStep,
      undefined,
      { atStep }
    );
  }
};

// 페이지 성능 추적
export const trackPagePerformance = () => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      // 페이지 로드 시간
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      trackPerformance('page_load', loadTime, {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstPaint: navigation.responseEnd - navigation.requestStart
      });
    }
  }
};

// 초기화 함수
export const initializeEventTracking = () => {
  // 페이지 로드 성능 측정
  window.addEventListener('load', () => {
    setTimeout(trackPagePerformance, 0);
  });
  
  // 전역 에러 추적
  window.addEventListener('error', (event) => {
    trackError('runtime', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });
  
  // Promise rejection 추적
  window.addEventListener('unhandledrejection', (event) => {
    trackError('runtime', `Unhandled Promise Rejection: ${event.reason}`, {
      reason: event.reason
    });
  });
};