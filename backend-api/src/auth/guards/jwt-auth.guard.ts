import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;
    if (authorization === undefined) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    const token = authorization.replace('Bearer ', '');
    const userInfo = await this.validate(token);
    if (userInfo) request.user = userInfo;
    return !!userInfo;
  }

  async validate(payload: any) {
    try {
      const secretKey = process.env.ACCESS_SECRET;
      const verify = await this.jwtService.verify(payload, { secret: secretKey });
      return verify
    } catch {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }
}
