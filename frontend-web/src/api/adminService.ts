import { apiHelper } from '../helpers/apiHelper';

interface DashboardStats {
  totalUsers: number;
  pendingApprovals: number;
  todayLogins: number;
  activeSessions: number;
  totalDashboards: number;
  totalWidgets: number;
  recentLogs: Array<{
    id: string;
    userEmail: string;
    action: string;
    createdAt: string;
  }>;
}

interface AdminHealthCheck {
  status: string;
  timestamp: string;
}

class AdminService {
  private readonly baseUrl = '/admin';

  /**
   * 관리자 대시보드 통계 데이터 조회
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await apiHelper.get<DashboardStats>(`${this.baseUrl}/dashboard/stats`);
      return response;
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      throw new Error('대시보드 통계를 불러오는데 실패했습니다.');
    }
  }

  /**
   * Admin 모듈 상태 확인
   */
  async healthCheck(): Promise<AdminHealthCheck> {
    try {
      const response = await apiHelper.get<AdminHealthCheck>(`${this.baseUrl}/health`);
      return response;
    } catch (error) {
      console.error('Failed to check admin health:', error);
      throw new Error('Admin 모듈 상태 확인에 실패했습니다.');
    }
  }

  /**
   * 사용자 목록 조회 (향후 구현)
   */
  async getUsers(page: number = 1, limit: number = 10): Promise<any> {
    try {
      const response = await apiHelper.get(`${this.baseUrl}/users`, {
        params: { page, limit }
      });
      return response;
    } catch (error) {
      console.error('Failed to get users:', error);
      throw new Error('사용자 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 승인 대기 사용자 목록 조회 (향후 구현)
   */
  async getPendingUsers(): Promise<any> {
    try {
      const response = await apiHelper.get(`${this.baseUrl}/users/pending`);
      return response;
    } catch (error) {
      console.error('Failed to get pending users:', error);
      throw new Error('승인 대기 사용자 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 감사 로그 조회 (향후 구현)
   */
  async getAuditLogs(page: number = 1, limit: number = 20): Promise<any> {
    try {
      const response = await apiHelper.get(`${this.baseUrl}/audit`, {
        params: { page, limit }
      });
      return response;
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw new Error('감사 로그를 불러오는데 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const adminService = new AdminService();