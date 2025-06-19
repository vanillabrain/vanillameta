import {
  User,
  Dashboard,
  Database,
  Dataset,
  Widget,
  Component,
  DatabaseType,
  Template,
  TemplateItem,
  ShareUrl,
} from './entities';

// Auth 관련 응답 타입
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface UserInfoResponse {
  user: User;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Dashboard 관련 응답 타입
export interface DashboardListResponse {
  dashboards: Dashboard[];
}

export interface DashboardDetailResponse {
  dashboard: Dashboard;
  widgets?: Widget[];
}

// Database 관련 응답 타입
export interface DatabaseListResponse {
  databases: Database[];
}

export interface DatabaseDetailResponse {
  databaseInfo: Database;
  tables: Array<{
    id: string;
    tableName: string;
    databaseId: number;
    datasetType: 'TABLE';
  }>;
  datasets: Array<
    Dataset & {
      datasetType: 'DATASET';
    }
  >;
}

export interface DatabaseTypeListResponse {
  types: DatabaseType[];
}

export interface ConnectionTestResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  totalCount: number;
  executionTime?: number;
}

export interface QueryExecuteResponse {
  result: QueryResult;
}

// Dataset 관련 응답 타입
export interface DatasetListResponse {
  datasets: Dataset[];
}

export interface DatasetDetailResponse {
  dataset?: Dataset;
  data?: QueryResult;
  // Dataset 필드들도 포함 (선택적)
  id?: number;
  title?: string;
  databaseId?: number;
  query?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Widget 관련 응답 타입
export interface WidgetListResponse {
  widgets: (Widget & { component?: Component })[];
}

export interface WidgetDetailResponse {
  widget: Widget;
  component?: Component;
  data?: QueryResult;
}

// Component 관련 응답 타입
export interface ComponentListResponse {
  components: Component[];
}

export interface ComponentDetailResponse {
  component: Component;
}

// Share 관련 응답 타입
export interface ShareDashboardResponse {
  dashboard: Dashboard;
  widgets: Widget[];
  shareInfo: ShareUrl;
}

export interface ShareTokenResponse {
  shareUrl: ShareUrl;
  url: string;
}

// Template 관련 응답 타입
export interface TemplateListResponse {
  templates: Template[];
}

export interface TemplateRecommendResponse {
  templates: Template[];
  items: TemplateItem[];
}

export interface TemplateDashboardResponse {
  dashboard: Dashboard;
  widgets: Widget[];
}
