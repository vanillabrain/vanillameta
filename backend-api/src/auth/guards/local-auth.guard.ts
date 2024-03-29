import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private jwtService: JwtService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { cookie } = request.headers;
    if (cookie === undefined) {
      throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
    }
    const token = cookie.replace('Bearer ', '').split('=')[1];
    const userInfo = await this.validate(token);
    if (userInfo) request.user = userInfo;
    return true;
  }

  async validate(payload: any) {
    try {
      const secretKey = process.env.REFRESH_SECRET;
      const verify = await this.jwtService.verify(payload, { secret: secretKey });
      return verify;
    } catch {
      throw new HttpException('Unathorization', HttpStatus.UNAUTHORIZED);
    }
  }
}
