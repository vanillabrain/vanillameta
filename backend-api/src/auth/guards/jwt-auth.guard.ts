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
    const urlAuth = request.headers['authorization-url'];
    if (authorization === undefined && urlAuth === undefined) {
      throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
    }
    if (authorization !== undefined) {
      const token = authorization.replace('Bearer ', ''); //authorization
      const boolean = true; // 일반 대시보드일시
      const userInfo = await this.validate(token, boolean);
      if (userInfo) request.user = userInfo;
      return !!userInfo;
    } else if (urlAuth !== undefined) {
      const token = urlAuth.replace('Bearer ', ''); //authorization-url
      const boolean = false; // 공유대시보드일시
      const userInfo = await this.validate(token, boolean);
      if (userInfo) request.user = userInfo;
      return !!userInfo;
    }
  }

  async validate(payload: any, accessPath: boolean) {
    if (accessPath === true) {
      try {
        const secretKey = process.env.ACCESS_SECRET;
        const verify = await this.jwtService.verify(payload, {
          secret: secretKey,
        });
        return verify;
      } catch {
        throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
      }
      if (accessPath === false) {
        try {
          // const secretUrlKey = process.env.URL_ACCESS_SECRET;
          const secretUrlKey = 'test1234';
          const verifyUrl = await this.jwtService.verify(payload, {
            secret: secretUrlKey,
          });
          return verifyUrl;
        } catch {
          throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
        }
      }
    }
  }
}
