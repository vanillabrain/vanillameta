import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { User } from '../../user/entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';

@Injectable()
export class RBACService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async assignRoleToUser(
    userId: number,
    roleId: string,
    assignedBy: number,
    expiresAt?: Date,
  ): Promise<void> {
    // 기존 할당 확인
    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (existingAssignment) {
      throw new BadRequestException('이미 할당된 역할입니다');
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedById: assignedBy,
      expiresAt,
      isActive: true,
    });

    await this.userRoleRepository.save(userRole);

    // 캐시 무효화
    await this.invalidateUserPermissionsCache(userId);

    // TODO: 감사 로그 기록 (AuditLogService 구현 후)
    // await this.auditLogService.log({
    //   action: 'ROLE_ASSIGNED',
    //   resourceType: 'User',
    //   resourceId: userId.toString(),
    //   userId: assignedBy,
    //   details: { roleId, expiresAt },
    // });
  }

  async removeRoleFromUser(
    userId: number,
    roleId: string,
    removedBy: number,
  ): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('할당된 역할을 찾을 수 없습니다');
    }

    userRole.isActive = false;
    await this.userRoleRepository.save(userRole);

    // 캐시 무효화
    await this.invalidateUserPermissionsCache(userId);

    // TODO: 감사 로그 기록
    // await this.auditLogService.log({
    //   action: 'ROLE_REMOVED',
    //   resourceType: 'User',
    //   resourceId: userId.toString(),
    //   userId: removedBy,
    //   details: { roleId },
    // });
  }

  async getUserPermissions(userId: number): Promise<Permission[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      return [];
    }

    const permissionMap = new Map<string, Permission>();
    
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissionMap.set(permission.id, permission);
      }
    }

    return Array.from(permissionMap.values());
  }

  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    const cacheKey = `user_permission_${userId}_${permissionName}`;
    
    let hasPermission = await this.cacheManager.get<boolean>(cacheKey);
    
    if (hasPermission === undefined) {
      const permissions = await this.getUserPermissions(userId);
      hasPermission = permissions.some(p => p.name === permissionName);
      
      // 5분간 캐시
      await this.cacheManager.set(cacheKey, hasPermission, 300);
    }

    return hasPermission;
  }

  async hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const userPermissionNames = permissions.map(p => p.name);
    
    return permissionNames.some(name => userPermissionNames.includes(name));
  }

  async getUserRoles(userId: number): Promise<Role[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    return user?.roles || [];
  }

  async getExpiredRoles(): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        isActive: true,
      },
      relations: ['user', 'role'],
    });
  }

  async cleanupExpiredRoles(): Promise<number> {
    const expiredRoles = await this.getExpiredRoles();
    
    if (expiredRoles.length === 0) {
      return 0;
    }

    await this.userRoleRepository.update(
      { id: In(expiredRoles.map(ur => ur.id)) },
      { isActive: false },
    );

    // 각 사용자의 권한 캐시 무효화
    const userIds = [...new Set(expiredRoles.map(ur => ur.userId))];
    await Promise.all(
      userIds.map(userId => this.invalidateUserPermissionsCache(userId)),
    );

    return expiredRoles.length;
  }

  private async invalidateUserPermissionsCache(userId: number): Promise<void> {
    const patterns = [
      `user_permissions_${userId}`,
      `user_permission_${userId}_*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.del(pattern);
    }
  }
}