import { Injectable, NestMiddleware, Logger, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { UserController } from '../../user/user.controller.js';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../entities/login-history.entity.js';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { YesNo } from '../../common/enum/yn.enum.js';

@Injectable()
export class shareUrlLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger(shareUrlLoggerMiddleware.name);
    constructor(
        @InjectRepository(LoginHistory) private readonly loginHisotryRepository: Repository<LoginHistory>,
    ) {}
    async use(req: Request, res: Response, next: NextFunction) {
        console.log(req)
        let loginSaveObj = {
            user_id: req.body.user_id,
            path: req.path,
            loginType: req.headers['user-agent'],
            loginSuccYn: YesNo.YES,
            createdAt: new Date()
        }
        this.logger.log(loginSaveObj)
        await this.loginHisotryRepository.save(loginSaveObj)
        next();

        // await this.loginHisotryRepository.save(saveObj)
        // 로그인 시간, 로그아웃 체크, 접속기기..?, explorer 어떤거?
    }
}