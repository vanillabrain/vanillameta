// 이벤트 추적 헬퍼 함수들

import { eventTracker } from './eventTracker';
import { EventAction, EventCategory, EventProperties } from './eventTypes';

// 대시보드 관련 추적
export const trackDashboard = {
  created: (dashboardId: string, dashboardName: string, templateUsed?: string) => {
    eventTracker.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD, {
      dashboardId,
      dashboardName,
      templateUsed,
    });
  },

  viewed: (dashboardId: string, dashboardName: string, loadTime?: number) => {
    const startTime = Date.now();
    eventTracker.track(EventAction.DASHBOARD_VIEWED, EventCategory.DASHBOARD, {
      dashboardId,
      dashboardName,
      loadTime,
    });
    return startTime; // 뷰 타이밍 측정을 위해 반환
  },

  edited: (dashboardId: string, changes: string[]) => {
    eventTracker.track(EventAction.DASHBOARD_EDITED, EventCategory.DASHBOARD, {
      dashboardId,
      changes,
    });
  },

  deleted: (dashboardId: string) => {
    eventTracker.track(EventAction.DASHBOARD_DELETED, EventCategory.DASHBOARD, {
      dashboardId,
    });
  },

  shared: (dashboardId: string, shareMethod: 'link' | 'email' | 'embed', permission?: 'view' | 'edit') => {
    eventTracker.track(EventAction.DASHBOARD_SHARED, EventCategory.SHARE, {
      dashboardId,
      shareMethod,
      sharePermission: permission,
    });
  },

  exported: (dashboardId: string, format: string) => {
    eventTracker.track(EventAction.DASHBOARD_EXPORTED, EventCategory.DASHBOARD, {
      dashboardId,
      exportFormat: format,
    });
  },
};

// 위젯 관련 추적
export const trackWidget = {
  created: (widgetId: string, widgetType: string, chartType: string, datasetId?: string) => {
    eventTracker.track(EventAction.WIDGET_CREATED, EventCategory.WIDGET, {
      widgetId,
      widgetType,
      chartType,
      datasetId,
    });
  },

  edited: (widgetId: string, changes: string[]) => {
    eventTracker.track(EventAction.WIDGET_EDITED, EventCategory.WIDGET, {
      widgetId,
      changes,
    });
  },

  deleted: (widgetId: string) => {
    eventTracker.track(EventAction.WIDGET_DELETED, EventCategory.WIDGET, {
      widgetId,
    });
  },

  resized: (widgetId: string, newSize: { width: number; height: number }) => {
    eventTracker.track(EventAction.WIDGET_RESIZED, EventCategory.WIDGET, {
      widgetId,
      newWidth: newSize.width,
      newHeight: newSize.height,
    });
  },

  moved: (widgetId: string, newPosition: { x: number; y: number }) => {
    eventTracker.track(EventAction.WIDGET_MOVED, EventCategory.WIDGET, {
      widgetId,
      newX: newPosition.x,
      newY: newPosition.y,
    });
  },
};

// 데이터베이스 관련 추적
export const trackDatabase = {
  connected: (databaseId: string, databaseType: string, success: boolean, errorMessage?: string) => {
    eventTracker.track(EventAction.DATABASE_CONNECTED, EventCategory.DATABASE, {
      databaseId,
      databaseType,
      connectionStatus: success ? 'success' : 'failed',
      errorMessage,
    });
  },

  disconnected: (databaseId: string) => {
    eventTracker.track(EventAction.DATABASE_DISCONNECTED, EventCategory.DATABASE, {
      databaseId,
    });
  },

  tested: (databaseId: string, databaseType: string, success: boolean, testDuration?: number) => {
    eventTracker.track(EventAction.DATABASE_TESTED, EventCategory.DATABASE, {
      databaseId,
      databaseType,
      connectionStatus: success ? 'success' : 'failed',
      executionTime: testDuration,
    });
  },

  queryExecuted: (queryId: string, datasetId: string, executionTime: number, rowCount?: number, success = true) => {
    eventTracker.track(success ? EventAction.QUERY_EXECUTED : EventAction.QUERY_FAILED, EventCategory.DATABASE, {
      queryId,
      datasetId,
      executionTime,
      rowCount,
      queryComplexity: executionTime > 5000 ? 'complex' : executionTime > 1000 ? 'medium' : 'simple',
    });
  },
};

// 사용자 관련 추적
export const trackUser = {
  registered: (userId: string, registrationMethod: string, email?: string) => {
    eventTracker.setUser(userId, { email });
    eventTracker.track(EventAction.USER_REGISTERED, EventCategory.USER, {
      userId,
      registrationMethod,
    });
  },

  loggedIn: (userId: string, loginMethod: string) => {
    eventTracker.setUser(userId);
    eventTracker.track(EventAction.USER_LOGIN, EventCategory.USER, {
      userId,
      loginMethod,
    });
  },

  loggedOut: () => {
    eventTracker.track(EventAction.USER_LOGOUT, EventCategory.USER);
    eventTracker.clearUser();
  },

  profileUpdated: (userId: string, updatedFields: string[]) => {
    eventTracker.track(EventAction.USER_PROFILE_UPDATED, EventCategory.USER, {
      userId,
      updatedFields,
    });
  },

  passwordChanged: (userId: string) => {
    eventTracker.track(EventAction.PASSWORD_CHANGED, EventCategory.USER, {
      userId,
    });
  },
};

// 템플릿 관련 추적
export const trackTemplate = {
  selected: (templateId: string, templateName: string, category?: string) => {
    eventTracker.track(EventAction.TEMPLATE_SELECTED, EventCategory.TEMPLATE, {
      templateId,
      templateName,
      templateCategory: category,
    });
  },

  applied: (templateId: string, dashboardId: string) => {
    eventTracker.track(EventAction.TEMPLATE_APPLIED, EventCategory.TEMPLATE, {
      templateId,
      dashboardId,
    });
  },
};

// 데이터셋 관련 추적
export const trackDataset = {
  created: (datasetId: string, datasetName: string, databaseId: string) => {
    eventTracker.track(EventAction.DATASET_CREATED, EventCategory.DATASET, {
      datasetId,
      datasetName,
      databaseId,
    });
  },

  edited: (datasetId: string, changes: string[]) => {
    eventTracker.track(EventAction.DATASET_EDITED, EventCategory.DATASET, {
      datasetId,
      changes,
    });
  },

  deleted: (datasetId: string) => {
    eventTracker.track(EventAction.DATASET_DELETED, EventCategory.DATASET, {
      datasetId,
    });
  },

  refreshed: (datasetId: string, refreshTime: number, rowCount?: number) => {
    eventTracker.track(EventAction.DATASET_REFRESHED, EventCategory.DATASET, {
      datasetId,
      executionTime: refreshTime,
      rowCount,
    });
  },
};

// 네비게이션 관련 추적
export const trackNavigation = {
  pageView: (path: string, title?: string) => {
    eventTracker.trackPageView(path, title);
  },

  click: (from: string, to: string, method: 'menu' | 'button' | 'link' | 'back' = 'link') => {
    eventTracker.track(EventAction.NAVIGATION_CLICK, EventCategory.NAVIGATION, {
      fromPage: from,
      toPage: to,
      navigationMethod: method,
    });
  },

  search: (query: string, resultCount: number, searchContext?: string) => {
    eventTracker.track(EventAction.SEARCH_PERFORMED, EventCategory.NAVIGATION, {
      searchQuery: query,
      resultCount,
      searchContext,
    });
  },

  filter: (filterType: string, filterValue: string, context?: string) => {
    eventTracker.track(EventAction.FILTER_APPLIED, EventCategory.NAVIGATION, {
      filterType,
      filterValue,
      filterContext: context,
    });
  },
};

// 공유 관련 추적
export const trackShare = {
  linkCreated: (shareId: string, dashboardId: string, permission: 'view' | 'edit', expirationDays?: number) => {
    eventTracker.track(EventAction.SHARE_LINK_CREATED, EventCategory.SHARE, {
      shareId,
      dashboardId,
      sharePermission: permission,
      expirationDays,
    });
  },

  linkAccessed: (shareId: string, dashboardId: string) => {
    eventTracker.track(EventAction.SHARE_LINK_ACCESSED, EventCategory.SHARE, {
      shareId,
      dashboardId,
    });
  },

  linkExpired: (shareId: string, dashboardId: string) => {
    eventTracker.track(EventAction.SHARE_LINK_EXPIRED, EventCategory.SHARE, {
      shareId,
      dashboardId,
    });
  },
};

// 성능 추적 헬퍼
export const trackPerformance = {
  // 페이지 로드 성능
  pageLoad: (pageName: string, loadTime: number) => {
    eventTracker.trackPerformance({
      name: `page_load_${pageName}`,
      value: loadTime,
      category: 'page_performance',
    });
  },

  // API 호출 성능
  apiCall: (endpoint: string, duration: number, status: 'success' | 'error') => {
    eventTracker.trackPerformance({
      name: `api_call_${endpoint}`,
      value: duration,
      category: 'api_performance',
      tags: { status },
    });
  },

  // 차트 렌더링 성능
  chartRender: (chartType: string, renderTime: number, dataPoints: number) => {
    eventTracker.trackPerformance({
      name: `chart_render_${chartType}`,
      value: renderTime,
      category: 'chart_performance',
      tags: { dataPoints: String(dataPoints) },
    });
  },

  // 쿼리 실행 성능
  queryExecution: (queryId: string, executionTime: number, rowCount: number) => {
    eventTracker.trackPerformance({
      name: `query_execution`,
      value: executionTime,
      category: 'query_performance',
      tags: {
        queryId,
        rowCount: String(rowCount),
        complexity: executionTime > 5000 ? 'complex' : executionTime > 1000 ? 'medium' : 'simple',
      },
    });
  },
};

// 에러 추적 헬퍼
export const trackError = {
  // API 에러
  apiError: (endpoint: string, statusCode: number, errorMessage: string) => {
    eventTracker.trackError(new Error(`API Error: ${endpoint} - ${statusCode}`), false, {
      endpoint,
      statusCode,
      errorMessage,
    });
  },

  // 렌더링 에러
  renderError: (componentName: string, error: Error) => {
    eventTracker.trackError(error, false, {
      component: componentName,
      errorBoundary: true,
    });
  },

  // 쿼리 에러
  queryError: (queryId: string, errorMessage: string, databaseType?: string) => {
    eventTracker.trackError(new Error(`Query Error: ${queryId}`), false, {
      queryId,
      errorMessage,
      databaseType,
    });
  },
};
