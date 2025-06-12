import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../entities/login-history.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../../common/enum/yn.enum.js';
import { CustomLoggerService } from '../../common/logger/logger.service';
import { User } from '../../user/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class userLoggerMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    private readonly logger: CustomLoggerService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId || req.body?.userId;
      const correlationId = req['correlationId'];

      const loginSaveObj = {
        userId: userId,
        path: req.path,
        login_type: req.headers['user-agent'],
        login_succyn: YesNo.YES,
        created_at: new Date(),
      };

      // 구조화된 로깅
      this.logger.logBusiness(
        'user_activity',
        {
          action: 'page_access',
          path: req.path,
          userAgent: req.headers['user-agent'],
          correlationId: correlationId,
        },
        userId,
        'UserLogger',
      );

      await this.loginHistoryRepository.save(loginSaveObj);

      next();
    } catch (error) {
      this.logger.error('Error in user logger middleware', error.stack, 'UserLogger', {
        path: req.path,
        userId: req.user?.userId || req.body?.userId,
        correlationId: req['correlationId'],
      });
      next(error);
    }
  }
}
