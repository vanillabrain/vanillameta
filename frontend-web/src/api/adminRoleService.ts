import { get, post, put, del } from '../helpers/apiHelper';

interface RoleFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  isActive?: boolean;
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateRoleRequest {
  name: string;
  displayName?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
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

interface Permission {
  key: string;
  value: string;
  category: string;
  action: string;
}

interface AvailablePermissions {
  permissions: Permission[];
  categories: Record<string, string>;
}

class AdminRoleService {
  private readonly baseUrl = '/admin/roles';

  /**
   * 역할 목록 조회
   */
  async getRoles(filters: RoleFilters = {}): Promise<PaginatedResponse<Role>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}?${queryParams.toString()}`;
      const response = await get<PaginatedResponse<Role>>(url);
      
      return response;
    } catch (error) {
      console.error('Failed to get roles:', error);
      throw new Error('역할 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 역할 상세 정보 조회
   */
  async getRoleById(id: number): Promise<Role> {
    try {
      const response = await get<Role>(`${this.baseUrl}/${id}`);
      return response;
    } catch (error) {
      console.error('Failed to get role by id:', error);
      throw new Error('역할 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 새 역할 생성
   */
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    try {
      const response = await post<Role>(this.baseUrl, roleData);
      return response;
    } catch (error) {
      console.error('Failed to create role:', error);
      throw new Error('역할 생성에 실패했습니다.');
    }
  }

  /**
   * 역할 정보 수정
   */
  async updateRole(id: number, roleData: UpdateRoleRequest): Promise<Role> {
    try {
      const response = await put<Role>(`${this.baseUrl}/${id}`, roleData);
      return response;
    } catch (error) {
      console.error('Failed to update role:', error);
      throw new Error('역할 정보 수정에 실패했습니다.');
    }
  }

  /**
   * 역할 삭제
   */
  async deleteRole(id: number): Promise<void> {
    try {
      await del(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw new Error('역할 삭제에 실패했습니다.');
    }
  }

  /**
   * 사용 가능한 권한 목록 조회
   */
  async getAvailablePermissions(): Promise<AvailablePermissions> {
    try {
      const response = await get<AvailablePermissions>(`${this.baseUrl}/permissions`);
      return response;
    } catch (error) {
      console.error('Failed to get available permissions:', error);
      throw new Error('권한 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 기본 역할 초기화
   */
  async initializeDefaultRoles(): Promise<void> {
    try {
      await post(`${this.baseUrl}/initialize-defaults`, {});
    } catch (error) {
      console.error('Failed to initialize default roles:', error);
      throw new Error('기본 역할 초기화에 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const adminRoleService = new AdminRoleService();

// 타입 내보내기
export type { Role, CreateRoleRequest, UpdateRoleRequest, Permission, AvailablePermissions, RoleFilters };