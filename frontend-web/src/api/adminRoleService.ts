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
  id: string;
  name: string;
  displayName: string;
  description: string;
  level: number;
  permissions: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RoleWithStats extends Role {
  userCount: number;
  permissionCount: number;
}

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string;
  module: string;
  resource: string;
  action: string;
}

interface UserBasic {
  id: string;
  name: string;
  email: string;
}

interface RoleDetail extends Omit<Role, 'permissions'> {
  permissions: Permission[];
  users: UserBasic[];
}

interface CreateRoleRequest {
  name: string;
  displayName?: string;
  description?: string;
  level?: number;
  permissionIds?: string[];
  isActive?: boolean;
  isDefault?: boolean;
}

interface UpdateRoleRequest {
  name?: string;
  displayName?: string;
  description?: string;
  level?: number;
  permissionIds?: string[];
  isActive?: boolean;
  isDefault?: boolean;
}

interface UpdateRolePermissionsRequest {
  permissionIds: string[];
}

interface AssignUsersToRoleRequest {
  userIds: string[];
  expiresAt?: string;
}

interface CloneRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  level?: number;
}

interface RoleDeletionImpact {
  roleId: string;
  roleName: string;
  affectedUserCount: number;
  affectedUsers: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  canDelete: boolean;
  warnings: string[];
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

type GroupedPermissions = Record<string, Record<string, Permission[]>>;

interface RoleUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
}

class AdminRoleService {
  private readonly baseUrl = '/admin/roles';

  /**
   * 역할 목록 조회 (통계 포함)
   */
  async getRoles(filters: RoleFilters = {}): Promise<RoleWithStats[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}?${queryParams.toString()}`;
      const response = await get<RoleWithStats[]>(url);
      
      return response;
    } catch (error) {
      console.error('Failed to get roles:', error);
      throw new Error('역할 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 역할 상세 정보 조회
   */
  async getRoleById(id: string): Promise<RoleDetail> {
    try {
      const response = await get<RoleDetail>(`${this.baseUrl}/${id}`);
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
  async updateRole(id: string, roleData: UpdateRoleRequest): Promise<Role> {
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
  async deleteRole(id: string): Promise<void> {
    try {
      await del(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw new Error('역할 삭제에 실패했습니다.');
    }
  }

  /**
   * 역할별 권한 조회
   */
  async getRolePermissions(id: string): Promise<Permission[]> {
    try {
      const response = await get<Permission[]>(`${this.baseUrl}/${id}/permissions`);
      return response;
    } catch (error) {
      console.error('Failed to get role permissions:', error);
      throw new Error('역할 권한을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 역할 권한 업데이트
   */
  async updateRolePermissions(id: string, permissions: UpdateRolePermissionsRequest): Promise<void> {
    try {
      await put(`${this.baseUrl}/${id}/permissions`, permissions);
    } catch (error) {
      console.error('Failed to update role permissions:', error);
      throw new Error('역할 권한 업데이트에 실패했습니다.');
    }
  }

  /**
   * 역할별 사용자 조회
   */
  async getRoleUsers(id: string, query: RoleUsersQuery = {}): Promise<PaginatedResponse<UserBasic>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.baseUrl}/${id}/users?${queryParams.toString()}`;
      const response = await get<PaginatedResponse<UserBasic>>(url);
      return response;
    } catch (error) {
      console.error('Failed to get role users:', error);
      throw new Error('역할 사용자를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 역할에 사용자 할당
   */
  async assignUsersToRole(id: string, assignData: AssignUsersToRoleRequest): Promise<void> {
    try {
      await post(`${this.baseUrl}/${id}/assign-users`, assignData);
    } catch (error) {
      console.error('Failed to assign users to role:', error);
      throw new Error('사용자 역할 할당에 실패했습니다.');
    }
  }

  /**
   * 역할에서 사용자 제거
   */
  async removeUserFromRole(roleId: string, userId: string): Promise<void> {
    try {
      await del(`${this.baseUrl}/${roleId}/users/${userId}`);
    } catch (error) {
      console.error('Failed to remove user from role:', error);
      throw new Error('사용자 역할 제거에 실패했습니다.');
    }
  }

  /**
   * 그룹화된 권한 목록 조회
   */
  async getGroupedPermissions(): Promise<GroupedPermissions> {
    try {
      const response = await get<GroupedPermissions>(`${this.baseUrl}/permissions/grouped`);
      return response;
    } catch (error) {
      console.error('Failed to get grouped permissions:', error);
      throw new Error('권한 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 역할 복사
   */
  async cloneRole(sourceId: string, cloneData: CloneRoleRequest): Promise<Role> {
    try {
      const response = await post<Role>(`${this.baseUrl}/${sourceId}/clone`, cloneData);
      return response;
    } catch (error) {
      console.error('Failed to clone role:', error);
      throw new Error('역할 복사에 실패했습니다.');
    }
  }

  /**
   * 역할 삭제 영향도 분석
   */
  async getRoleDeletionImpact(id: string): Promise<RoleDeletionImpact> {
    try {
      const response = await get<RoleDeletionImpact>(`${this.baseUrl}/${id}/impact-analysis`);
      return response;
    } catch (error) {
      console.error('Failed to get role deletion impact:', error);
      throw new Error('역할 삭제 영향도 분석에 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const adminRoleService = new AdminRoleService();

// 타입 내보내기
export type { 
  Role, 
  RoleWithStats,
  RoleDetail,
  Permission,
  UserBasic,
  CreateRoleRequest, 
  UpdateRoleRequest, 
  UpdateRolePermissionsRequest,
  AssignUsersToRoleRequest,
  CloneRoleRequest,
  RoleDeletionImpact,
  RoleFilters,
  RoleUsersQuery,
  GroupedPermissions,
  PaginatedResponse
};