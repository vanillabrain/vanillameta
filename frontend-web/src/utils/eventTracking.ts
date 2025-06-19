// 사용자 행동 분석 이벤트 추적 시스템 - 새로운 통합 버전

import {
  trackUser,
  trackDashboard as trackDashboardHelpers,
  trackWidget as trackWidgetHelpers,
  trackDatabase as trackDatabaseHelpers,
  // trackDataset as trackDatasetHelpers,  // 사용되지 않음
  // trackNavigation,  // 사용되지 않음
  trackPerformance as trackPerformanceHelpers,
  trackError as trackErrorHelpers,
  eventTracker,
} from './analytics';

// 기존 코드와의 호환성을 위한 이벤트 카테고리 (기존 enum 유지)
export enum EventCategory {
  DASHBOARD = 'dashboard',
  WIDGET = 'widget',
  DATA = 'data',
  USER = 'user',
  ONBOARDING = 'onboarding',
  PERFORMANCE = 'performance',
  ERROR = 'error',
}

// 기존 이벤트 액션 enum (호환성 유지)
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
  VALIDATION_ERROR = 'validation_error',
}

// 기존 코드와의 호환성을 위한 래퍼 함수
export const trackUserEvent = (
  category: EventCategory,
  action: EventAction,
  label?: string,
  value?: number,
  metadata?: Record<string, any>,
) => {
  // 새로운 시스템으로 전달
  // EventAction과 EventCategory를 새로운 시스템에 맞게 매핑
  console.log('Legacy trackUserEvent called:', { category, action, label, value, metadata });
};

// 성능 측정 헬퍼 (기존 호환성 유지)
export const trackPerformance = (
  metricName: string,
  duration: number,
  // metadata?: Record<string, any>  // 현재 사용되지 않음
) => {
  trackPerformanceHelpers.pageLoad(metricName, duration);
};

// 에러 추적 헬퍼 (기존 호환성 유지)
export const trackError = (
  errorType: 'api' | 'runtime' | 'validation',
  errorMessage: string,
  metadata?: Record<string, any>,
) => {
  switch (errorType) {
    case 'api':
      trackErrorHelpers.apiError(metadata?.endpoint || 'unknown', metadata?.statusCode || 0, errorMessage);
      break;
    case 'runtime':
      trackErrorHelpers.renderError(metadata?.component || 'unknown', new Error(errorMessage));
      break;
    case 'validation':
      // validation 에러는 일반 에러로 처리
      eventTracker.trackError(new Error(errorMessage), false, metadata);
      break;
  }
};

// 사용자 세션 추적 (새로운 시스템 사용)
export const trackUserSession = {
  login: (method: string, userId: string) => {
    trackUser.loggedIn(userId, method);
  },

  logout: () => {
    // userId 파라미터 제거 - 사용되지 않음
    trackUser.loggedOut();
  },

  register: (method: string, userId: string) => {
    trackUser.registered(userId, method);
  },
};

// 대시보드 이벤트 추적 (새로운 시스템 사용)
export const trackDashboardEvent = {
  created: (dashboardId: string, templateUsed?: string) => {
    trackDashboardHelpers.created(dashboardId, dashboardId, templateUsed);
  },

  viewed: (dashboardId: string, viewDuration?: number) => {
    const startTime = trackDashboardHelpers.viewed(dashboardId, dashboardId, viewDuration);
    return startTime;
  },

  edited: (dashboardId: string, changes: string[]) => {
    trackDashboardHelpers.edited(dashboardId, changes);
  },

  deleted: (dashboardId: string) => {
    trackDashboardHelpers.deleted(dashboardId);
  },

  shared: (dashboardId: string, shareMethod: 'link' | 'email' | 'embed') => {
    trackDashboardHelpers.shared(dashboardId, shareMethod);
  },
};

// 위젯 이벤트 추적 (새로운 시스템 사용)
export const trackWidgetEvent = {
  created: (widgetId: string, chartType: string, dashboardId: string) => {
    trackWidgetHelpers.created(widgetId, 'chart', chartType, dashboardId);
  },

  edited: (widgetId: string, changes: string[]) => {
    trackWidgetHelpers.edited(widgetId, changes);
  },

  deleted: (widgetId: string) => {
    trackWidgetHelpers.deleted(widgetId);
  },

  resized: (widgetId: string, newSize: { width: number; height: number }) => {
    trackWidgetHelpers.resized(widgetId, newSize);
  },

  moved: (widgetId: string, newPosition: { x: number; y: number }) => {
    trackWidgetHelpers.moved(widgetId, newPosition);
  },
};

// 데이터 이벤트 추적 (새로운 시스템 사용)
export const trackDataEvent = {
  databaseConnected: (databaseType: string, success: boolean, connectionId?: string) => {
    trackDatabaseHelpers.connected(connectionId || 'unknown', databaseType, success);
  },

  queryExecuted: (datasetId: string, executionTime: number, rowCount?: number) => {
    trackDatabaseHelpers.queryExecuted('unknown', datasetId, executionTime, rowCount, true);
  },

  queryFailed: (datasetId: string, errorMessage: string) => {
    trackDatabaseHelpers.queryExecuted('unknown', datasetId, 0, undefined, false);
    trackErrorHelpers.queryError(datasetId, errorMessage);
  },
};

// 온보딩 이벤트 추적 (새로운 시스템 사용하지만 온보딩 전용 헬퍼가 없으므로 직접 구현)
export const trackOnboardingEvent = {
  started: () => {
    eventTracker.track(EventAction.ONBOARDING_STARTED as any, EventCategory.ONBOARDING as any, { step: 'start' });
  },

  stepCompleted: (stepName: string, stepNumber: number) => {
    eventTracker.track(EventAction.ONBOARDING_STEP_COMPLETED as any, EventCategory.ONBOARDING as any, {
      stepName,
      stepNumber,
    });
  },

  completed: (completedSteps: string[]) => {
    eventTracker.track(EventAction.ONBOARDING_COMPLETED as any, EventCategory.ONBOARDING as any, {
      completedSteps,
      totalSteps: completedSteps.length,
    });
  },

  skipped: (atStep: string) => {
    eventTracker.track(EventAction.ONBOARDING_SKIPPED as any, EventCategory.ONBOARDING as any, { skippedAt: atStep });
  },
};

// 페이지 성능 추적
export const trackPagePerformance = () => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      // 페이지 로드 시간
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      trackPerformanceHelpers.pageLoad(window.location.pathname, loadTime);
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
  window.addEventListener('error', event => {
    trackErrorHelpers.renderError('window', new Error(event.message));
  });

  // Promise rejection 추적
  window.addEventListener('unhandledrejection', event => {
    eventTracker.trackError(new Error(`Unhandled Promise Rejection: ${event.reason}`), false);
  });
};
