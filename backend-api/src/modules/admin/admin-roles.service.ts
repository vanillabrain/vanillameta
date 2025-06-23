import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../../user/entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { RBACService } from './rbac.service';
import { AuditLogService } from './audit-log.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  GetRolesQueryDto,
  RoleResponseDto,
} from './dto/role.dto';
import {
  RoleWithStatsDto,
  RoleDetailDto,
  PermissionDto,
  UserBasicDto,
  UpdateRolePermissionsDto,
  AssignUsersToRoleDto,
  GetRoleUsersQueryDto,
  GroupedPermissionsDto,
  CloneRoleDto,
  RoleDeletionImpactDto,
} from './dto/role-management.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class AdminRolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
  ) {}

  async getRolesWithStats(query: GetRolesQueryDto): Promise<RoleWithStatsDto[]> {
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .loadRelationCountAndMap('role.userCount', 'role.users');

    if (query.search) {
      qb.andWhere(
        '(role.name ILIKE :search OR role.displayName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.isActive !== undefined) {
      qb.andWhere('role.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('role.level', 'DESC');

    const roles = await qb.getMany();

    return roles.map(role => ({
      ...this.mapToRoleResponseDto(role),
      userCount: (role as any).userCount || 0,
      permissionCount: role.permissions?.length || 0,
    }));
  }

  async getRoleDetail(id: string): Promise<RoleDetailDto> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions', 'users'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    return {
      ...this.mapToRoleResponseDto(role),
      permissions: role.permissions.map(p => this.mapToPermissionDto(p)),
      users: role.users.map(u => this.mapToUserBasicDto(u)),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async createRole(createRoleDto: CreateRoleDto, creator: User): Promise<RoleResponseDto> {
    // 역할명 중복 확인
    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new BadRequestException('이미 존재하는 역할명입니다');
    }

    const role = this.roleRepository.create({
      ...createRoleDto,
      isActive: true,
    });

    const savedRole = await this.roleRepository.save(role);

    // 권한 할당
    if (createRoleDto.permissionIds?.length) {
      const permissions = await this.permissionRepository.findByIds(
        createRoleDto.permissionIds,
      );
      savedRole.permissions = permissions;
      await this.roleRepository.save(savedRole);
    }

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'ROLE_CREATED',
      resourceType: 'role',
      resourceId: savedRole.id,
      userId: creator.id.toString(),
      userEmail: creator.email,
      details: { 
        message: `새 역할 생성: ${savedRole.name}`,
        roleName: savedRole.name,
        permissionCount: createRoleDto.permissionIds?.length || 0,
      },
    });

    return this.mapToRoleResponseDto(savedRole);
  }

  async updateRole(
    id: string,
    updateRoleDto: UpdateRoleDto,
    updater: User,
  ): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    // 시스템 기본 역할 수정 제한
    if (['super_admin', 'admin'].includes(role.name)) {
      throw new ForbiddenException('시스템 기본 역할은 수정할 수 없습니다');
    }

    const oldData = { ...role };

    // 기본 정보 업데이트
    Object.assign(role, updateRoleDto);

    const updatedRole = await this.roleRepository.save(role);

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'ROLE_UPDATED',
      resourceType: 'role',
      resourceId: id,
      userId: updater.id.toString(),
      userEmail: updater.email,
      details: { 
        message: `역할 업데이트: ${role.name}`,
        oldData: {
          displayName: oldData.displayName,
          description: oldData.description,
          level: oldData.level,
        },
        newData: {
          displayName: updatedRole.displayName,
          description: updatedRole.description,
          level: updatedRole.level,
        },
      },
    });

    return this.mapToRoleResponseDto(updatedRole);
  }

  async updateRolePermissions(
    roleId: string,
    updatePermissionsDto: UpdateRolePermissionsDto,
    updater: User,
  ): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    const oldPermissionIds = role.permissions.map(p => p.id);
    const newPermissions = await this.permissionRepository.findByIds(
      updatePermissionsDto.permissionIds,
    );

    role.permissions = newPermissions;
    await this.roleRepository.save(role);

    // 해당 역할을 가진 모든 사용자의 권한 캐시 무효화
    const usersWithRole = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId })
      .getMany();

    // 권한 캐시 무효화는 RBAC 서비스 내부적으로 처리

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'ROLE_PERMISSIONS_UPDATED',
      resourceType: 'role',
      resourceId: roleId,
      userId: updater.id.toString(),
      userEmail: updater.email,
      details: { 
        message: `역할 권한 업데이트: ${role.name}`,
        oldPermissionIds,
        newPermissionIds: updatePermissionsDto.permissionIds,
        affectedUserCount: usersWithRole.length,
      },
    });
  }

  async getRolePermissions(id: string): Promise<PermissionDto[]> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    return role.permissions.map(p => this.mapToPermissionDto(p));
  }

  async getRoleUsers(
    roleId: string,
    query: GetRoleUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserBasicDto>> {
    const { page = 1, limit = 20, search } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId });

    if (search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.skip((page - 1) * limit).take(limit);

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map(u => this.mapToUserBasicDto(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async assignUsersToRole(
    roleId: string,
    assignUsersDto: AssignUsersToRoleDto,
    assigner: User,
  ): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    const users = await this.userRepository.findByIds(assignUsersDto.userIds);

    if (users.length !== assignUsersDto.userIds.length) {
      throw new BadRequestException('일부 사용자를 찾을 수 없습니다');
    }

    // 사용자별로 역할 할당
    for (const user of users) {
      const existingUserRole = await this.userRoleRepository.findOne({
        where: { userId: user.id, roleId },
      });

      if (!existingUserRole) {
        const userRole = this.userRoleRepository.create({
          userId: user.id,
          roleId,
          expiresAt: assignUsersDto.expiresAt ? new Date(assignUsersDto.expiresAt) : null,
        });
        await this.userRoleRepository.save(userRole);
      }
    }

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'USERS_ASSIGNED_TO_ROLE',
      resourceType: 'role',
      resourceId: roleId,
      userId: assigner.id.toString(),
      userEmail: assigner.email,
      details: { 
        message: `사용자 역할 할당: ${role.name}`,
        roleName: role.name,
        assignedUserIds: assignUsersDto.userIds,
        expiresAt: assignUsersDto.expiresAt,
      },
    });
  }

  async removeUserFromRole(
    roleId: string,
    userId: string,
    remover: User,
  ): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId: userId as any, roleId },
    });

    if (!userRole) {
      throw new NotFoundException('사용자의 역할 할당을 찾을 수 없습니다');
    }

    await this.userRoleRepository.remove(userRole);

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'USER_REMOVED_FROM_ROLE',
      resourceType: 'role',
      resourceId: roleId,
      userId: remover.id.toString(),
      userEmail: remover.email,
      details: { 
        message: `사용자 역할 제거`,
        removedUserId: userId,
      },
    });
  }

  async getGroupedPermissions(): Promise<GroupedPermissionsDto> {
    const permissions = await this.permissionRepository.find({
      order: { module: 'ASC', resource: 'ASC', action: 'ASC' },
    });

    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = {};
      }
      if (!acc[permission.module][permission.resource]) {
        acc[permission.module][permission.resource] = [];
      }
      acc[permission.module][permission.resource].push(this.mapToPermissionDto(permission));
      return acc;
    }, {} as GroupedPermissionsDto);

    return grouped;
  }

  async cloneRole(
    sourceRoleId: string,
    cloneRoleDto: CloneRoleDto,
    creator: User,
  ): Promise<RoleResponseDto> {
    const sourceRole = await this.roleRepository.findOne({
      where: { id: sourceRoleId },
      relations: ['permissions'],
    });

    if (!sourceRole) {
      throw new NotFoundException('복사할 역할을 찾을 수 없습니다');
    }

    const clonedRole = this.roleRepository.create({
      name: cloneRoleDto.name,
      displayName: cloneRoleDto.displayName,
      description: cloneRoleDto.description || `${sourceRole.description} (복사본)`,
      level: cloneRoleDto.level || sourceRole.level - 1,
      isActive: true,
      permissions: sourceRole.permissions,
    });

    const savedRole = await this.roleRepository.save(clonedRole);

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'ROLE_CLONED',
      resourceType: 'role',
      resourceId: savedRole.id,
      userId: creator.id.toString(),
      userEmail: creator.email,
      details: { 
        message: `역할 복사: ${sourceRole.name} -> ${savedRole.name}`,
        sourceRoleId,
        sourceRoleName: sourceRole.name,
        newRoleName: savedRole.name,
      },
    });

    return this.mapToRoleResponseDto(savedRole);
  }

  async getRoleDeletionImpact(roleId: string): Promise<RoleDeletionImpactDto> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['users'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다');
    }

    const affectedUsers = role.users.map(user => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
    }));

    return {
      roleId,
      roleName: role.name,
      affectedUserCount: affectedUsers.length,
      affectedUsers,
      canDelete: !role.isDefault && affectedUsers.length === 0,
      warnings: [
        ...(role.isDefault ? ['기본 역할은 삭제할 수 없습니다'] : []),
        ...(affectedUsers.length > 0 ? [`${affectedUsers.length}명의 사용자가 영향받습니다`] : []),
      ],
    };
  }

  async deleteRole(id: string, deleter: User): Promise<void> {
    const impact = await this.getRoleDeletionImpact(id);

    if (!impact.canDelete) {
      throw new BadRequestException(impact.warnings.join(', '));
    }

    const role = await this.roleRepository.findOne({ where: { id } });
    await this.roleRepository.remove(role);

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: 'ROLE_DELETED',
      resourceType: 'role',
      resourceId: id,
      userId: deleter.id.toString(),
      userEmail: deleter.email,
      details: { 
        message: `역할 삭제: ${role.name}`,
        roleName: role.name,
      },
    });
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

  private mapToPermissionDto(permission: Permission): PermissionDto {
    return {
      id: permission.id,
      name: permission.name,
      displayName: permission.displayName,
      description: permission.description,
      module: permission.module,
      resource: permission.resource,
      action: permission.action,
    };
  }

  private mapToUserBasicDto(user: User): UserBasicDto {
    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
    };
  }
}