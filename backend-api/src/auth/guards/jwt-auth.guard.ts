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
      const token = authorization.replace('Bearer ', ''); //authorization-url
      const boolean = true; // 일반 대시보드일시
      const userInfo = await this.validate(token, boolean);
      if (userInfo) request.user = userInfo;
      return !!userInfo;
    } else {
      const token = urlAuth.replace('Bearer ', ''); //authorization-url
      const boolean = false; // 공유대시보드일시
      const userInfo = await this.validate(token, boolean);
      if (userInfo) request.user = userInfo;
      return !!userInfo;
    }
  }

  async validate(payload: any, accessPath: boolean) {
    // try {
    if (accessPath === true) {
      const secretKey = process.env.ACCESS_SECRET;
      const verify = await this.jwtService.verify(payload, {
        secret: secretKey,
      });
      return verify;
    }
    if (accessPath === false) {
      // const secretUrlKey = process.env.URL_ACCESS_SECRET;
      const secretUrlKey = 'test1234';
      const verifyUrl = await this.jwtService.verify(payload, {
        secret: secretUrlKey,
      });
      return verifyUrl;
    }
    throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
  }
  // } catch {
  //   throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
  // }}
}
