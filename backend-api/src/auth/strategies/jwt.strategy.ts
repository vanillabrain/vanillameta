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
      secretOrKey: true,
    });
  }

  async validate(req, payload: any) {
    this.logger.debug('JWT token validation', 'JwtStrategy', {
      userId: payload.userId,
      correlationId: req?.correlationId,
      tokenExp: payload.exp,
    });

    // JWT 페이로드 검증 성공
    return { userId: payload.userId };
  }
}
