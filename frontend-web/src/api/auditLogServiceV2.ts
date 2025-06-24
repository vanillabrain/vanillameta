import { get, post } from '../helpers/apiHelper';
import {
  AuditLog,
  AuditLogFilters,
  CreateAuditLogRequest,
  PaginatedResponse,
  AuditLogStats,
  AvailableActions,
  ExportAuditLogsDto,
  ExportPreview,
  RelatedLogsRequest,
  AuditLogLevel,
  AuditLogCategory
} from '../types/audit';

class AuditLogServiceV2 {
  private readonly baseUrl = '/admin/audit-logs';

  /**
   * 감사 로그 목록 조회
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<PaginatedResponse<AuditLog>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (value instanceof Date) {
            queryParams.append(key, value.toISOString());
          } else {
            queryParams.append(key, value.toString());
          }
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
  async getAuditLogStats(filters?: { dateFrom?: Date; dateTo?: Date }): Promise<AuditLogStats> {
    try {
      const queryParams = new URLSearchParams();
      if (filters?.dateFrom) {
        queryParams.append('dateFrom', filters.dateFrom.toISOString());
      }
      if (filters?.dateTo) {
        queryParams.append('dateTo', filters.dateTo.toISOString());
      }

      const url = `${this.baseUrl}/stats?${queryParams.toString()}`;
      const response = await get<AuditLogStats>(url);
      return response;
    } catch (error) {
      console.error('Failed to get audit log stats:', error);
      throw new Error('감사 로그 통계를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용 가능한 액션 목록 조회
   */
  async getAvailableActions(): Promise<string[]> {
    try {
      const response = await get<string[]>(`${this.baseUrl}/actions`);
      return response;
    } catch (error) {
      console.error('Failed to get available actions:', error);
      throw new Error('액션 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용 가능한 리소스 타입 목록 조회
   */
  async getAvailableResourceTypes(): Promise<string[]> {
    try {
      const response = await get<string[]>(`${this.baseUrl}/resource-types`);
      return response;
    } catch (error) {
      console.error('Failed to get available resource types:', error);
      throw new Error('리소스 타입 목록을 불러오는데 실패했습니다.');
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
   * 관련 로그 조회
   */
  async getRelatedLogs(params: RelatedLogsRequest): Promise<AuditLog[]> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}/related?${queryParams.toString()}`;
      const response = await get<AuditLog[]>(url);
      return response;
    } catch (error) {
      console.error('Failed to get related logs:', error);
      throw new Error('관련 로그를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 감사 로그 내보내기
   */
  async exportAuditLogs(params: ExportAuditLogsDto): Promise<Blob> {
    try {
      const response = await post(`${this.baseUrl}/export`, params, {
        responseType: 'blob'
      });
      return response as unknown as Blob;
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw new Error('감사 로그 내보내기에 실패했습니다.');
    }
  }

  /**
   * 내보내기 미리보기
   */
  async getExportPreview(params: ExportAuditLogsDto): Promise<ExportPreview> {
    try {
      const response = await post<ExportPreview>(`${this.baseUrl}/export/preview`, params);
      return response;
    } catch (error) {
      console.error('Failed to get export preview:', error);
      throw new Error('내보내기 미리보기를 불러오는데 실패했습니다.');
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
      'user.login': '사용자 로그인',
      'user.logout': '사용자 로그아웃',
      'user.register': '사용자 가입',
      'user.update': '사용자 정보 수정',
      'user.delete': '사용자 삭제',
      'user.approve': '사용자 승인',
      'user.reject': '사용자 거부',
      'user.password_change': '비밀번호 변경',
      'user.password_reset': '비밀번호 재설정',
      'role.create': '역할 생성',
      'role.update': '역할 수정',
      'role.delete': '역할 삭제',
      'role.assign': '역할 할당',
      'role.revoke': '역할 회수',
      'dashboard.create': '대시보드 생성',
      'dashboard.update': '대시보드 수정',
      'dashboard.delete': '대시보드 삭제',
      'dashboard.share': '대시보드 공유',
      'dashboard.unshare': '대시보드 공유 해제',
      'widget.create': '위젯 생성',
      'widget.update': '위젯 수정',
      'widget.delete': '위젯 삭제',
      'database.connect': '데이터베이스 연결',
      'database.disconnect': '데이터베이스 연결 해제',
      'database.query': '데이터베이스 쿼리',
      'system.config_update': '시스템 설정 변경',
      'system.backup': '시스템 백업',
      'system.restore': '시스템 복원',
      'admin.access': '관리자 페이지 접근',
      'admin.user_view': '관리자 사용자 조회',
      'admin.role_view': '관리자 역할 조회',
      'admin.audit_export': '감사 로그 내보내기',
    };

    return actionMap[action] || action;
  }

  /**
   * 헬퍼 메서드: 카테고리 표시명 반환
   */
  getCategoryDisplayName(category: AuditLogCategory): string {
    const categoryMap: Record<AuditLogCategory, string> = {
      [AuditLogCategory.USER_MANAGEMENT]: '사용자 관리',
      [AuditLogCategory.AUTHENTICATION]: '인증',
      [AuditLogCategory.AUTHORIZATION]: '권한',
      [AuditLogCategory.DATA_ACCESS]: '데이터 접근',
      [AuditLogCategory.SYSTEM_CONFIG]: '시스템 설정',
      [AuditLogCategory.SECURITY]: '보안',
      [AuditLogCategory.DASHBOARD]: '대시보드',
      [AuditLogCategory.WIDGET]: '위젯',
      [AuditLogCategory.DATABASE]: '데이터베이스',
    };

    return categoryMap[category] || category;
  }

  /**
   * 헬퍼 메서드: 리소스 타입 표시명 반환
   */
  getResourceTypeDisplayName(resourceType: string): string {
    const resourceMap: Record<string, string> = {
      'user': '사용자',
      'role': '역할',
      'dashboard': '대시보드',
      'widget': '위젯',
      'database': '데이터베이스',
      'system': '시스템',
      'config': '설정',
    };

    return resourceMap[resourceType] || resourceType;
  }

  /**
   * 헬퍼 메서드: 레벨 색상 반환
   */
  getLevelColor(level: AuditLogLevel): string {
    const colorMap: Record<AuditLogLevel, string> = {
      [AuditLogLevel.INFO]: 'blue',
      [AuditLogLevel.WARNING]: 'gold',
      [AuditLogLevel.ERROR]: 'red',
      [AuditLogLevel.CRITICAL]: 'magenta',
    };

    return colorMap[level] || 'default';
  }

  /**
   * 헬퍼 메서드: 카테고리 색상 반환
   */
  getCategoryColor(category: AuditLogCategory): string {
    const colorMap: Record<AuditLogCategory, string> = {
      [AuditLogCategory.USER_MANAGEMENT]: 'cyan',
      [AuditLogCategory.AUTHENTICATION]: 'green',
      [AuditLogCategory.AUTHORIZATION]: 'orange',
      [AuditLogCategory.DATA_ACCESS]: 'blue',
      [AuditLogCategory.SYSTEM_CONFIG]: 'purple',
      [AuditLogCategory.SECURITY]: 'red',
      [AuditLogCategory.DASHBOARD]: 'geekblue',
      [AuditLogCategory.WIDGET]: 'lime',
      [AuditLogCategory.DATABASE]: 'volcano',
    };

    return colorMap[category] || 'default';
  }

  /**
   * 헬퍼 메서드: 상태 표시명 반환
   */
  getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      'success': '성공',
      'error': '오류',
      'warning': '경고',
      'pending': '대기중',
      'failed': '실패',
    };

    return statusMap[status] || status;
  }

  /**
   * 헬퍼 메서드: 상태 색상 반환
   */
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'success': '#52c41a',
      'error': '#f5222d',
      'warning': '#faad14',
      'pending': '#1890ff',
      'failed': '#ff4d4f',
    };

    return colorMap[status] || '#d9d9d9';
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const auditLogServiceV2 = new AuditLogServiceV2();