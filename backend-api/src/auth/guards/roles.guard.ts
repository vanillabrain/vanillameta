import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * @Roles() 로 지정된 역할을 가진 사용자만 통과시킨다.
 * JwtAuthGuard 뒤에 실행되어 request.user(검증된 토큰 payload)를 사용한다.
 * 역할은 DB 에서 조회하므로 역할 변경이 즉시 반영된다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const accessKeyData = request.user?.accessKeyData;
    if (!accessKeyData?.id) {
      throw new UnauthorizedException('accessTokenExpired');
    }

    const user = await this.userRepository.findOne({ where: { id: accessKeyData.id } });
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('forbidden');
    }
    return true;
  }
}
