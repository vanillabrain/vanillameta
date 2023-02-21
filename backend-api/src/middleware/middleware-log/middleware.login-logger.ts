import { Injectable, NestMiddleware, Logger, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../entities/login-history.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../../common/enum/yn.enum.js';

@Injectable()
export class loginLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(loginLoggerMiddleware.name);
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHisotryRepository: Repository<LoginHistory>,
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    if (req.url === '/signin') {
      const loginSaveObj = {
        userId: req.body?.userId,
        path: req?.path,
        login_Type: req?.headers['user-agent'],
        login_succYn: YesNo.YES,
        created_at: new Date(),
      };
      this.logger.log(loginSaveObj);
      await this.loginHisotryRepository.save(loginSaveObj);
      return next();
    }

    if (req.url === '/signout') {
      const logoutSaveObj = {
        userId: req.body.userId,
        path: req.path,
        loginType: req.headers['user-agent'],
        loginSuccYn: YesNo.NO,
        createdAt: new Date(),
      };
      this.logger.log(logoutSaveObj);
      await this.loginHisotryRepository.save(logoutSaveObj);
      return next();
    }
    next();
    // await this.loginHisotryRepository.save(saveObj)
    // 로그인 시간, 로그아웃 체크, 접속기기..?, explorer 어떤거?
  }
}
