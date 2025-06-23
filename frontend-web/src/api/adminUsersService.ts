import { apiHelper } from '../helpers/apiHelper';

interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface User {
  id: string;
  userId: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
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

interface UserStats {
  totalUsers: number;
  recentUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingUsers: number;
}

class AdminUsersService {
  private readonly baseUrl = '/admin/users';

  /**
   * 사용자 목록 조회
   */
  async getUsers(filters: UserFilters = {}): Promise<PaginatedResponse<User>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}?${queryParams.toString()}`;
      const response = await apiHelper.get<PaginatedResponse<User>>(url);
      
      return response;
    } catch (error) {
      console.error('Failed to get users:', error);
      throw new Error('사용자 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 사용자 상세 정보 조회
   */
  async getUserById(id: string): Promise<User> {
    try {
      const response = await apiHelper.get<User>(`${this.baseUrl}/${id}`);
      return response;
    } catch (error) {
      console.error('Failed to get user by id:', error);
      throw new Error('사용자 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용자 상태 변경
   */
  async updateUserStatus(id: string, status: string): Promise<User> {
    try {
      const response = await apiHelper.put<User>(`${this.baseUrl}/${id}/status`, {
        status
      });
      return response;
    } catch (error) {
      console.error('Failed to update user status:', error);
      throw new Error('사용자 상태 변경에 실패했습니다.');
    }
  }

  /**
   * 사용자 통계 조회
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await apiHelper.get<UserStats>(`${this.baseUrl}/stats/summary`);
      return response;
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw new Error('사용자 통계를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 일괄 작업 (향후 구현)
   */
  async bulkAction(action: string, userIds: string[]): Promise<void> {
    try {
      await apiHelper.post(`${this.baseUrl}/bulk-action`, {
        action,
        userIds
      });
    } catch (error) {
      console.error('Failed to perform bulk action:', error);
      throw new Error('일괄 작업에 실패했습니다.');
    }
  }

  /**
   * 사용자 생성 (향후 구현)
   */
  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const response = await apiHelper.post<User>(this.baseUrl, userData);
      return response;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error('사용자 생성에 실패했습니다.');
    }
  }

  /**
   * 사용자 정보 수정 (향후 구현)
   */
  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    try {
      const response = await apiHelper.put<User>(`${this.baseUrl}/${id}`, userData);
      return response;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw new Error('사용자 정보 수정에 실패했습니다.');
    }
  }

  /**
   * 사용자 삭제 (향후 구현)
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await apiHelper.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw new Error('사용자 삭제에 실패했습니다.');
    }
  }

  /**
   * 승인 대기 중인 사용자 목록 조회
   */
  async getPendingUsers(filters: UserFilters = {}): Promise<PaginatedResponse<User>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}/pending?${queryParams.toString()}`;
      const response = await apiHelper.get<PaginatedResponse<User>>(url);
      
      return response;
    } catch (error) {
      console.error('Failed to get pending users:', error);
      throw new Error('승인 대기 사용자 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용자 승인
   */
  async approveUser(id: string, reason?: string): Promise<User> {
    try {
      const response = await apiHelper.post<User>(`${this.baseUrl}/${id}/approve`, {
        reason
      });
      return response;
    } catch (error) {
      console.error('Failed to approve user:', error);
      throw new Error('사용자 승인에 실패했습니다.');
    }
  }

  /**
   * 사용자 거부
   */
  async rejectUser(id: string, reason: string): Promise<User> {
    try {
      const response = await apiHelper.post<User>(`${this.baseUrl}/${id}/reject`, {
        reason
      });
      return response;
    } catch (error) {
      console.error('Failed to reject user:', error);
      throw new Error('사용자 거부에 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const adminUsersService = new AdminUsersService();