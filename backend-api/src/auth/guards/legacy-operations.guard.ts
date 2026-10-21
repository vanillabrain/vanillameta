import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Global legacy diagnostics are server operations, never implicit organization-admin privileges. */
@Injectable()
export class LegacyOperationsGuard extends JwtAuthGuard {
  constructor(jwt: JwtService, db: DataSource, private readonly config: ConfigService) {
    super(jwt, db);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) return false;
    const actor = context.switchToHttp().getRequest().user?.accessKeyData?.id;
    const configured = this.config.get<string>('LEGACY_OPERATIONS_USER_IDS') ?? '';
    const entries =
      typeof configured === 'string' ? configured.split(',').map(value => value.trim()) : [];
    const allowed =
      Number.isSafeInteger(actor) &&
      actor > 0 &&
      entries.some(value => /^[1-9]\d*$/.test(value) && Number(value) === actor);
    if (!allowed) throw new ForbiddenException('운영 관리 권한이 필요합니다.');
    return true;
  }
}
