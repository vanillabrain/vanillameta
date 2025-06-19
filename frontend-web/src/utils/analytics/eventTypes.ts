// 이벤트 추적 타입 정의

// 이벤트 카테고리
export enum EventCategory {
  DASHBOARD = 'Dashboard',
  WIDGET = 'Widget',
  DATABASE = 'Database',
  USER = 'User',
  NAVIGATION = 'Navigation',
  SHARE = 'Share',
  TEMPLATE = 'Template',
  DATASET = 'Dataset',
}

// 이벤트 액션
export enum EventAction {
  // Dashboard Actions
  DASHBOARD_CREATED = 'dashboard_created',
  DASHBOARD_VIEWED = 'dashboard_viewed',
  DASHBOARD_EDITED = 'dashboard_edited',
  DASHBOARD_DELETED = 'dashboard_deleted',
  DASHBOARD_SHARED = 'dashboard_shared',
  DASHBOARD_EXPORTED = 'dashboard_exported',

  // Widget Actions
  WIDGET_CREATED = 'widget_created',
  WIDGET_EDITED = 'widget_edited',
  WIDGET_DELETED = 'widget_deleted',
  WIDGET_RESIZED = 'widget_resized',
  WIDGET_MOVED = 'widget_moved',

  // Database Actions
  DATABASE_CONNECTED = 'database_connected',
  DATABASE_DISCONNECTED = 'database_disconnected',
  DATABASE_TESTED = 'database_tested',
  QUERY_EXECUTED = 'query_executed',
  QUERY_FAILED = 'query_failed',

  // User Actions
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  PASSWORD_CHANGED = 'password_changed',

  // Navigation Actions
  PAGE_VIEWED = 'page_viewed',
  NAVIGATION_CLICK = 'navigation_click',
  SEARCH_PERFORMED = 'search_performed',
  FILTER_APPLIED = 'filter_applied',

  // Template Actions
  TEMPLATE_SELECTED = 'template_selected',
  TEMPLATE_APPLIED = 'template_applied',

  // Dataset Actions
  DATASET_CREATED = 'dataset_created',
  DATASET_EDITED = 'dataset_edited',
  DATASET_DELETED = 'dataset_deleted',
  DATASET_REFRESHED = 'dataset_refreshed',

  // Share Actions
  SHARE_LINK_CREATED = 'share_link_created',
  SHARE_LINK_ACCESSED = 'share_link_accessed',
  SHARE_LINK_EXPIRED = 'share_link_expired',
}

// 이벤트 속성 타입
export interface EventProperties {
  // 공통 속성
  timestamp?: number;
  sessionId?: string;
  userId?: string;
  correlationId?: string;

  // Dashboard 관련
  dashboardId?: string;
  dashboardName?: string;
  templateUsed?: string;
  widgetCount?: number;

  // Widget 관련
  widgetId?: string;
  widgetType?: string;
  chartType?: string;
  datasetId?: string;

  // Database 관련
  databaseId?: string;
  databaseType?: string;
  connectionStatus?: 'success' | 'failed';
  errorMessage?: string;

  // Query 관련
  queryId?: string;
  executionTime?: number;
  rowCount?: number;
  queryComplexity?: 'simple' | 'medium' | 'complex';

  // Navigation 관련
  fromPage?: string;
  toPage?: string;
  navigationMethod?: 'menu' | 'button' | 'link' | 'back';

  // Share 관련
  shareMethod?: 'link' | 'email' | 'embed';
  sharePermission?: 'view' | 'edit';
  expirationDays?: number;

  // Performance 관련
  loadTime?: number;
  renderTime?: number;
  apiCallDuration?: number;

  // 기타 커스텀 속성
  [key: string]: any;
}

// 사용자 속성
export interface UserProperties {
  userId: string;
  email?: string;
  role?: string;
  registrationDate?: string;
  lastLoginDate?: string;
  dashboardCount?: number;
  widgetCount?: number;
  databaseCount?: number;
  plan?: 'free' | 'pro' | 'enterprise';
}

// 이벤트 전체 구조
export interface AnalyticsEvent {
  action: EventAction;
  category: EventCategory;
  label?: string;
  value?: number;
  properties?: EventProperties;
  userProperties?: UserProperties;
}

// 성능 메트릭
export interface PerformanceMetric {
  name: string;
  value: number;
  category?: string;
  tags?: Record<string, string>;
}

// 세션 정보
export interface SessionInfo {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  pageViews: number;
  eventCount: number;
}
