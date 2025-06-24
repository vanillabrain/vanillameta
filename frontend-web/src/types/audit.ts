// 감사 로그 관련 타입 정의

export enum AuditLogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum AuditLogCategory {
  USER_MANAGEMENT = 'user_management',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  SYSTEM_CONFIG = 'system_config',
  SECURITY = 'security',
  DASHBOARD = 'dashboard',
  WIDGET = 'widget',
  DATABASE = 'database'
}

export interface AuditLog {
  id: number;
  action: string;
  level: AuditLogLevel;
  category: AuditLogCategory;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  details?: string;
  metadata?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: string;
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  status?: string;
  level?: AuditLogLevel;
  category?: AuditLogCategory;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateAuditLogRequest {
  action: string;
  level?: AuditLogLevel;
  category?: AuditLogCategory;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  details?: string;
  metadata?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  weeklyLogs: number;
  monthlyLogs: number;
  statusBreakdown: {
    success: number;
    error: number;
    warning: number;
  };
  categoryBreakdown: Record<AuditLogCategory, number>;
  topActions: Array<{
    action: string;
    count: number;
  }>;
  recentActivity: Array<{
    hour: string;
    count: number;
  }>;
}

export interface ActionInfo {
  key: string;
  value: string;
  category: string;
}

export interface AvailableActions {
  actions: ActionInfo[];
  categories: Record<string, string>;
}

export interface ExportAuditLogsDto {
  dateFrom?: Date;
  dateTo?: Date;
  format: 'csv' | 'json';
  limit?: number;
  includeDetails?: boolean;
  includeSensitive?: boolean;
  actions?: string[];
  levels?: AuditLogLevel[];
  categories?: AuditLogCategory[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface ExportPreview {
  estimatedSize: number;
  recordCount: number;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface RelatedLogsRequest {
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  timeRange?: string;
  exclude?: number;
}