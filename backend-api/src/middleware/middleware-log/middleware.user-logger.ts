import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../entities/login-history.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../../common/enum/yn.enum.js';
import { ApiBearerAuth } from '@nestjs/swagger';

@Injectable()
export class userLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(userLoggerMiddleware.name);
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHisotryRepository: Repository<LoginHistory>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // const { userId } = req.user.accessKeyData;
    console.log('확인', req.user);
    const loginSaveObj = {
      userId: req.body?.userId,
      path: req.path,
      login_type: req.headers['user-agent'],
      login_succyn: YesNo.YES,
      created_at: new Date(),
    };
    this.logger.log(loginSaveObj);
    await this.loginHisotryRepository.save(loginSaveObj);
    next();

    // await this.loginHisotryRepository.save(saveObj)
    // 로그인 시간, 로그아웃 체크, 접속기기..?, explorer 어떤거?
  }
}
