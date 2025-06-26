import { get, post } from '../helpers/apiHelper';

interface AuditLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
  details: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: string;
  createdAt: string;
}

interface CreateAuditLogRequest {
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  weeklyLogs: number;
  monthlyLogs: number;
  statusBreakdown: {
    success: number;
    error: number;
    warning: number;
  };
}

interface ActionInfo {
  key: string;
  value: string;
  category: string;
}

interface AvailableActions {
  actions: ActionInfo[];
  categories: Record<string, string>;
}

class AuditLogService {
  private readonly baseUrl = '/admin/audit-logs';

  /**
   * 감사 로그 목록 조회
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<PaginatedResponse<AuditLog>> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}?${queryParams.toString()}`;
      const response = await get<PaginatedResponse<AuditLog>>(url);

      return response;
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw new Error('감사 로그 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 감사 로그 상세 정보 조회
   */
  async getAuditLogById(id: number): Promise<AuditLog> {
    try {
      const response = await get<AuditLog>(`${this.baseUrl}/${id}`);
      return response;
    } catch (error) {
      console.error('Failed to get audit log by id:', error);
      throw new Error('감사 로그 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 새 감사 로그 생성
   */
  async createAuditLog(logData: CreateAuditLogRequest): Promise<AuditLog> {
    try {
      const response = await post<AuditLog>(this.baseUrl, logData);
      return response;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      throw new Error('감사 로그 생성에 실패했습니다.');
    }
  }

  /**
   * 감사 로그 통계 조회
   */
  async getAuditLogStats(): Promise<AuditLogStats> {
    try {
      const response = await get<AuditLogStats>(`${this.baseUrl}/stats`);
      return response;
    } catch (error) {
      console.error('Failed to get audit log stats:', error);
      throw new Error('감사 로그 통계를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용 가능한 액션 목록 조회
   */
  async getAvailableActions(): Promise<AvailableActions> {
    try {
      const response = await get<AvailableActions>(`${this.baseUrl}/actions`);
      return response;
    } catch (error) {
      console.error('Failed to get available actions:', error);
      throw new Error('액션 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 사용자의 감사 로그 조회
   */
  async getUserAuditLogs(userId: string, limit?: number): Promise<AuditLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (limit) {
        queryParams.append('limit', limit.toString());
      }

      const url = `${this.baseUrl}/user/${userId}?${queryParams.toString()}`;
      const response = await get<AuditLog[]>(url);
      return response;
    } catch (error) {
      console.error('Failed to get user audit logs:', error);
      throw new Error('사용자 감사 로그를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 헬퍼 메서드: 오늘 날짜 문자열 반환
   */
  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 헬퍼 메서드: N일 전 날짜 문자열 반환
   */
  getDaysAgoDateString(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  /**
   * 헬퍼 메서드: 액션 표시명 반환
   */
  getActionDisplayName(action: string): string {
    const actionMap: Record<string, string> = {
      user_login: '사용자 로그인',
      user_logout: '사용자 로그아웃',
      user_register: '사용자 가입',
      user_update: '사용자 정보 수정',
      user_delete: '사용자 삭제',
      user_approve: '사용자 승인',
      user_reject: '사용자 거부',
      role_create: '역할 생성',
      role_update: '역할 수정',
      role_delete: '역할 삭제',
      dashboard_create: '대시보드 생성',
      dashboard_update: '대시보드 수정',
      dashboard_delete: '대시보드 삭제',
      dashboard_share: '대시보드 공유',
      widget_create: '위젯 생성',
      widget_update: '위젯 수정',
      widget_delete: '위젯 삭제',
      system_config_update: '시스템 설정 변경',
      system_backup: '시스템 백업',
      admin_access: '관리자 페이지 접근',
      admin_user_view: '관리자 사용자 조회',
      admin_role_view: '관리자 역할 조회',
    };

    return actionMap[action] || action;
  }

  /**
   * 헬퍼 메서드: 상태 표시명 반환
   */
  getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      success: '성공',
      error: '오류',
      warning: '경고',
    };

    return statusMap[status] || status;
  }

  /**
   * 헬퍼 메서드: 상태 색상 반환
   */
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
    };

    return colorMap[status] || '#6c757d';
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const auditLogService = new AuditLogService();

// 타입 내보내기
export type { AuditLog, CreateAuditLogRequest, AuditLogFilters, AuditLogStats, AvailableActions, ActionInfo };
