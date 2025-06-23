import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Role } from './entities/role.entity';
import { 
  CreateRoleDto, 
  UpdateRoleDto, 
  GetRolesQueryDto, 
  RoleResponseDto,
  DEFAULT_PERMISSIONS 
} from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async createRole(createRoleDto: CreateRoleDto): Promise<RoleResponseDto> {
    try {
      // 이름 중복 체크
      const existingRole = await this.roleRepository.findOne({
        where: { name: createRoleDto.name }
      });

      if (existingRole) {
        throw new ConflictException('이미 존재하는 역할 이름입니다.');
      }

      const role = this.roleRepository.create({
        ...createRoleDto,
        displayName: createRoleDto.displayName || createRoleDto.name,
        permissions: createRoleDto.permissions || [],
        isSystemRole: false,
      });

      const savedRole = await this.roleRepository.save(role);
      return this.mapToRoleResponseDto(savedRole);
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  async getRoles(query: GetRolesQueryDto) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        isActive
      } = query;

      const qb = this.roleRepository.createQueryBuilder('role');

      // 검색 기능
      if (search) {
        qb.where('(role.name LIKE :search OR role.displayName LIKE :search OR role.description LIKE :search)', {
          search: `%${search}%`
        });
      }

      // 활성 상태 필터
      if (isActive !== undefined) {
        qb.andWhere('role.isActive = :isActive', { isActive });
      }

      // 정렬
      qb.orderBy(`role.${sortBy}`, sortOrder);

      // 페이지네이션
      const offset = (page - 1) * limit;
      qb.skip(offset).take(limit);

      const [roles, total] = await qb.getManyAndCount();

      return {
        data: roles.map(role => this.mapToRoleResponseDto(role)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting roles:', error);
      throw error;
    }
  }

  async getRoleById(id: number): Promise<RoleResponseDto> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id }
      });

      if (!role) {
        throw new NotFoundException('역할을 찾을 수 없습니다.');
      }

      return this.mapToRoleResponseDto(role);
    } catch (error) {
      console.error('Error getting role by id:', error);
      throw error;
    }
  }

  async updateRole(id: number, updateRoleDto: UpdateRoleDto): Promise<RoleResponseDto> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id }
      });

      if (!role) {
        throw new NotFoundException('역할을 찾을 수 없습니다.');
      }

      // 시스템 역할은 일부 수정 제한
      if (role.isSystemRole) {
        console.log('시스템 역할 수정 시도:', role.name);
        // YOLO 모드: 경고만 출력하고 계속 진행
      }

      Object.assign(role, updateRoleDto);
      const updatedRole = await this.roleRepository.save(role);

      return this.mapToRoleResponseDto(updatedRole);
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  async deleteRole(id: number): Promise<void> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id }
      });

      if (!role) {
        throw new NotFoundException('역할을 찾을 수 없습니다.');
      }

      // 시스템 역할 삭제 방지
      if (role.isSystemRole) {
        throw new ConflictException('시스템 역할은 삭제할 수 없습니다.');
      }

      await this.roleRepository.remove(role);
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  /**
   * 기본 역할들을 생성
   * YOLO 모드: 시스템 시작 시 기본 역할 생성
   */
  async initializeDefaultRoles(): Promise<void> {
    try {
      const defaultRoles = [
        {
          name: 'admin',
          displayName: '관리자',
          description: '시스템 전체 관리 권한',
          permissions: Object.values(DEFAULT_PERMISSIONS),
          isSystemRole: true,
        },
        {
          name: 'user',
          displayName: '일반 사용자',
          description: '기본 사용자 권한',
          permissions: [
            DEFAULT_PERMISSIONS.DASHBOARD_READ,
            DEFAULT_PERMISSIONS.DASHBOARD_CREATE,
            DEFAULT_PERMISSIONS.WIDGET_READ,
            DEFAULT_PERMISSIONS.WIDGET_CREATE,
          ],
          isSystemRole: true,
        },
        {
          name: 'viewer',
          displayName: '조회자',
          description: '읽기 전용 권한',
          permissions: [
            DEFAULT_PERMISSIONS.DASHBOARD_READ,
            DEFAULT_PERMISSIONS.WIDGET_READ,
          ],
          isSystemRole: true,
        },
      ];

      for (const roleData of defaultRoles) {
        const existingRole = await this.roleRepository.findOne({
          where: { name: roleData.name }
        });

        if (!existingRole) {
          const role = this.roleRepository.create(roleData);
          await this.roleRepository.save(role);
          console.log(`기본 역할 생성: ${roleData.name}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default roles:', error);
    }
  }

  /**
   * 사용 가능한 모든 권한 목록 조회
   */
  async getAvailablePermissions() {
    return {
      permissions: Object.entries(DEFAULT_PERMISSIONS).map(([key, value]) => ({
        key,
        value,
        category: value.split(':')[0],
        action: value.split(':')[1],
      })),
      categories: {
        user: '사용자 관리',
        dashboard: '대시보드 관리',
        widget: '위젯 관리',
        admin: '관리자 기능',
        system: '시스템 관리',
      }
    };
  }

  private mapToRoleResponseDto(role: Role): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName || role.name,
      description: role.description || '',
      permissions: role.permissions || [],
      isActive: role.isActive,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}