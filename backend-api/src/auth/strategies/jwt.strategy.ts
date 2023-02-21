import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
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
    console.log('check', req);
    // { userId: payload.userId, password: payload.password }
    return true;
  }
}
