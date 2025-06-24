import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ANY_PERMISSIONS_KEY } from '../decorators/require-any-permission.decorator';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 권한 요구사항이 없으면 통과
    if ((!requiredPermissions || requiredPermissions.length === 0) && 
        (!anyPermissions || anyPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userPermissions = await this.getUserPermissions(user.id);
    
    // ALL 권한 확인 (모든 권한이 있어야 함)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = this.checkAllPermissions(requiredPermissions, userPermissions);
      if (hasAllPermissions) return true;
    }

    // ANY 권한 확인 (하나라도 있으면 됨)
    if (anyPermissions && anyPermissions.length > 0) {
      return this.checkAnyPermissions(anyPermissions, userPermissions);
    }

    return false;
  }

  private async getUserPermissions(userId: number): Promise<string[]> {
    const cacheKey = `user_permissions_${userId}`;
    
    let permissions = await this.cacheManager.get<string[]>(cacheKey);
    
    if (!permissions) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user) {
        return [];
      }

      const permissionSet = new Set<string>();
      
      for (const role of user.roles) {
        for (const permission of role.permissions) {
          permissionSet.add(permission.name);
        }
      }

      permissions = Array.from(permissionSet);
      
      // 5분간 캐시
      await this.cacheManager.set(cacheKey, permissions, 300);
    }

    return permissions;
  }

  private checkAllPermissions(
    requiredPermissions: string[],
    userPermissions: string[],
  ): boolean {
    // AND 조건: 모든 권한이 있어야 함
    return requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );
  }

  private checkAnyPermissions(
    anyPermissions: string[],
    userPermissions: string[],
  ): boolean {
    // OR 조건: 하나라도 있으면 됨
    return anyPermissions.some(permission =>
      userPermissions.includes(permission)
    );
  }
}