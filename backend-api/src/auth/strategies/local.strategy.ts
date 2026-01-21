import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { CustomLoggerService } from '../../common/logger/logger.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: CustomLoggerService,
  ) {
    super();
  }

  async validate(req, payload: any): Promise<any> {
    this.logger.debug('Local authentication attempt', 'LocalStrategy', {
      userId: payload.userId,
      correlationId: req?.correlationId,
      ip: req?.ip,
    });

    const user = await this.authService.validateUser(payload.userId, payload.password);
    if (!user) {
      this.logger.warn('Local authentication failed', 'LocalStrategy', {
        userId: payload.userId,
        correlationId: req?.correlationId,
      });
      throw new UnauthorizedException();
    }

    this.logger.log('Local authentication successful', 'LocalStrategy', {
      userId: payload.userId,
      correlationId: req?.correlationId,
    });

    return user;
  }
}
