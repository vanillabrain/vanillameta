import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CustomLoggerService } from '../../common/logger/logger.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly logger: CustomLoggerService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromHeader('Authorization'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.ACCESS_SECRET,
    });
  }

  async validate(payload: any) {
    this.logger.debug('JWT token validation', 'JwtStrategy', {
      payload: payload,
      accessKeyData: payload.accessKeyData,
    });

    // JWT 페이로드에서 accessKeyData 추출
    if (payload.accessKeyData) {
      return { accessKeyData: payload.accessKeyData };
    }

    // 페이로드 구조 디버깅을 위한 로그
    this.logger.warn('JWT payload structure is unexpected', 'JwtStrategy', {
      payload: payload,
    });

    return payload;
  }
}
