import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { 
  CreateRoleDto, 
  UpdateRoleDto, 
  GetRolesQueryDto, 
  RoleResponseDto,
} from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
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
        name: createRoleDto.name,
        displayName: createRoleDto.displayName || createRoleDto.name,
        description: createRoleDto.description,
        level: createRoleDto.level || 0,
        isActive: createRoleDto.isActive !== false,
        isDefault: createRoleDto.isDefault || false,
      });

      // 권한 할당
      if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
        const permissions = await this.permissionRepository.findByIds(createRoleDto.permissionIds);
        role.permissions = permissions;
      }

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
        search,
        isActive
      } = query;

      const queryBuilder = this.roleRepository.createQueryBuilder('role')
        .leftJoinAndSelect('role.permissions', 'permissions');

      if (search) {
        queryBuilder.andWhere(
          '(role.name LIKE :search OR role.displayName LIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (isActive !== undefined) {
        queryBuilder.andWhere('role.isActive = :isActive', { isActive });
      }

      queryBuilder
        .orderBy('role.level', 'DESC')
        .addOrderBy('role.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      const [roles, total] = await queryBuilder.getManyAndCount();

      const roleDtos = roles.map(role => this.mapToRoleResponseDto(role));

      return {
        data: roleDtos,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting roles:', error);
      throw error;
    }
  }

  async getRoleById(id: string): Promise<RoleResponseDto> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id },
        relations: ['permissions']
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

  async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<RoleResponseDto> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id },
        relations: ['permissions']
      });

      if (!role) {
        throw new NotFoundException('역할을 찾을 수 없습니다.');
      }

      // 시스템 역할은 수정 제한
      if (role.name === 'super_admin') {
        throw new ConflictException('시스템 역할은 수정할 수 없습니다.');
      }

      // 이름 변경 시 중복 체크
      if (updateRoleDto.name && updateRoleDto.name !== role.name) {
        const existingRole = await this.roleRepository.findOne({
          where: { name: updateRoleDto.name }
        });

        if (existingRole) {
          throw new ConflictException('이미 존재하는 역할 이름입니다.');
        }
      }

      // 기본 정보 업데이트
      Object.assign(role, {
        name: updateRoleDto.name || role.name,
        displayName: updateRoleDto.displayName || role.displayName,
        description: updateRoleDto.description !== undefined ? updateRoleDto.description : role.description,
        level: updateRoleDto.level !== undefined ? updateRoleDto.level : role.level,
        isActive: updateRoleDto.isActive !== undefined ? updateRoleDto.isActive : role.isActive,
        isDefault: updateRoleDto.isDefault !== undefined ? updateRoleDto.isDefault : role.isDefault,
      });

      // 권한 업데이트
      if (updateRoleDto.permissionIds) {
        if (updateRoleDto.permissionIds.length === 0) {
          role.permissions = [];
        } else {
          const permissions = await this.permissionRepository.findByIds(updateRoleDto.permissionIds);
          role.permissions = permissions;
        }
      }

      const savedRole = await this.roleRepository.save(role);
      return this.mapToRoleResponseDto(savedRole);
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  async deleteRole(id: string): Promise<void> {
    try {
      const role = await this.roleRepository.findOne({
        where: { id },
        relations: ['users']
      });

      if (!role) {
        throw new NotFoundException('역할을 찾을 수 없습니다.');
      }

      // 시스템 역할 삭제 제한
      if (role.name === 'super_admin') {
        throw new ConflictException('시스템 역할은 삭제할 수 없습니다.');
      }

      // 사용자가 할당된 역할 삭제 제한
      if (role.users && role.users.length > 0) {
        throw new ConflictException('사용자가 할당된 역할은 삭제할 수 없습니다.');
      }

      await this.roleRepository.remove(role);
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  private mapToRoleResponseDto(role: Role): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      level: role.level,
      isActive: role.isActive,
      isDefault: role.isDefault,
      permissions: role.permissions ? role.permissions.map(p => p.name) : [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}