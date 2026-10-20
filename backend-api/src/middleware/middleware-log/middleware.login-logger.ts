import { safeRouteTemplate } from '../../common/utils/safe-route-template';
import { serializeMetadataWork } from '../../common/metadata-work';
import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../entities/login-history.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../../common/enum/yn.enum';
import { CustomLoggerService } from '../../common/logger/logger.service';

@Injectable()
export class loginLoggerMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    @Optional() private readonly logger?: CustomLoggerService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.url === '/signin') {
        const userId = req.body?.userId;
        const correlationId = req['correlationId'];

        const loginSaveObj = {
          userId: userId,
          path: safeRouteTemplate(req),
          login_Type: req?.headers['user-agent'],
          login_succYn: YesNo.YES,
          created_at: new Date(),
        };

        // 구조화된 로깅
        this.logger?.logBusiness(
          'user_login',
          {
            action: 'login_attempt',
            path: safeRouteTemplate(req),
            userAgent: req.headers['user-agent'],
            correlationId: correlationId,
            ip: req.ip || req.connection?.remoteAddress,
          },
          userId,
          'LoginLogger',
        );

        await serializeMetadataWork(this.loginHistoryRepository.manager.connection, () =>
          this.loginHistoryRepository.save(loginSaveObj),
        );
        return next();
      }

      // TODO: 로그아웃 로깅 기능 추가 예정
      // if (req.url === '/signout') {
      //   const userId = req.body?.userId;
      //   this.logger?.logBusiness('user_logout', {
      //     action: 'logout',
      //     correlationId: req['correlationId']
      //   }, userId, 'LoginLogger');
      // }

      next();
    } catch (error) {
      this.logger?.error('Error in login logger middleware', error.stack, 'LoginLogger', {
        path: safeRouteTemplate(req),
        correlationId: req['correlationId'],
      });
      next(error);
    }
  }
}
