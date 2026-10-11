import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private readonly authService: AuthService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let token = request.cookies?.jwt_re;
    const cookie = request.headers?.cookie;
    if (token === undefined && typeof cookie === 'string') {
      const entry = cookie.split(';').find(part => part.trim().startsWith('jwt_re='));
      if (entry) {
        try {
          token = decodeURIComponent(entry.trim().slice('jwt_re='.length));
        } catch {
          throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
        }
      }
    }
    if (typeof token !== 'string' || !token) {
      throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
    }
    const userInfo = await this.validate(token);
    if (!userInfo) throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
    request.user = userInfo;
    return true;
  }

  async validate(payload: any) {
    try {
      return await this.authService.verifyRefreshToken(payload);
    } catch {
      throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
    }
  }
}
