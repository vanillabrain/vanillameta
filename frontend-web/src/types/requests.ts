// Auth 관련 요청 타입
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateUserRequest {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

// Dashboard 관련 요청 타입
export interface CreateDashboardRequest {
  title: string;
  templateId?: number;
  layout?: string;
  seq?: number;
  widgets?: any[];
}

export interface UpdateDashboardRequest {
  title?: string;
  layout?: string;
  seq?: number;
  widgets?: any[];
}

// Database 관련 요청 타입
export interface CreateDatabaseRequest {
  name: string;
  description?: string;
  connectionConfig: Record<string, any>;
  engine: string;
  type?: string;
  timezone?: string;
}

export interface UpdateDatabaseRequest {
  name?: string;
  description?: string;
  connectionConfig?: Record<string, any>;
  engine?: string;
  type?: string;
  timezone?: string;
}

export interface TestConnectionRequest {
  engine: string;
  connectionConfig: Record<string, any>;
}

export interface QueryExecuteRequest {
  databaseId: number;
  query: string;
  limit?: number;
}

// Dataset 관련 요청 타입
export interface CreateDatasetRequest {
  title?: string;
  databaseId: number;
  query: string;
}

export interface UpdateDatasetRequest {
  title?: string;
  databaseId?: number;
  query?: string;
}

// Widget 관련 요청 타입
export interface CreateWidgetRequest {
  title?: string;
  description?: string;
  componentId: number;
  datasetType: 'TABLE' | 'DATASET';
  datasetId: number;
  option: string; // JSON 문자열
}

export interface UpdateWidgetRequest {
  title?: string;
  description?: string;
  componentId?: number;
  datasetType?: 'TABLE' | 'DATASET';
  datasetId?: number;
  option?: string; // JSON 문자열
}

// Component 관련 요청 타입
export interface CreateComponentRequest {
  type: string;
  title: string;
  description?: string;
  category?: string;
  option: string; // JSON 문자열
  icon?: string;
  seq?: number;
  useYn?: string;
}

export interface UpdateComponentRequest {
  type?: string;
  title?: string;
  description?: string;
  category?: string;
  option?: string; // JSON 문자열
  icon?: string;
  seq?: number;
  useYn?: string;
}

// Share 관련 요청 타입
export interface ShareTokenRequest {
  expiredAt?: string;
}

// Template 관련 요청 타입
export interface TemplateRecommendRequest {
  databaseIds: number[];
  preferences?: Record<string, any>;
}