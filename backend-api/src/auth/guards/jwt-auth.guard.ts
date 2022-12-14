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
      throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
    }
    const token = authorization.replace('Bearer ', '');

    const userInfo = await this.validate(token);
    console.log(userInfo);
    if (userInfo) request.user = userInfo;
    return !!userInfo;
  }

  async validate(payload: any) {
    try {
      const secretKey = process.env.ACCESS_SECRET;
      const verify = await this.jwtService.verify(payload, {
        secret: secretKey,
      });
      return verify;
    } catch {
      const secretUrlKey = process.env.URL_ACCESS_SECRET;
      const verifyUrl = await this.jwtService.verify(payload, {
        secret: secretUrlKey,
      });
      if (verifyUrl) {
        return verifyUrl;
      }
      throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
    }
  }
}
