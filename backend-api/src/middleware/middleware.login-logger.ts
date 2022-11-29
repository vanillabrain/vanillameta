import { Injectable, NestMiddleware, Logger, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { UserController } from 'src/user/user.controller';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


@Injectable()
export class loginLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger(loginLoggerMiddleware.name);
    constructor(
        @InjectRepository(LoginHistory) private readonly loginHisotryRepository: Repository<LoginHistory>,
    ) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler<any>,
    ): Observable<any> | Promise<Observable<any>> {
        return next.handle().pipe(
            map( async data => {

                await this.loginHisotryRepository.save({
                    // findLoginNo.statusCode = data['statusCode']
                });
                this.logger.debug(data);
                return data;
            }),
        );
    }

    async use(req: Request, res: Response, next: NextFunction) {

        if(req.url === '/signin'){
            let loginSaveObj = {
                user_id: req.body.user_id,
                loginType: req.headers['user-agent'],
                createAt: new Date()
            }
            await this.loginHisotryRepository.save(loginSaveObj)
            return next();
        }
        if(req.url === '/signout'){
            let logoutSaveObj = {
                user_id: req.body.user_id,
                logoutType: req.headers['user-agent'],
                createdAt: new Date()
            }
            await this.loginHisotryRepository.save(logoutSaveObj);
            return next();
        }

        // await this.loginHisotryRepository.save(saveObj)
        // 로그인 시간, 로그아웃 체크, 접속기기..?, explorer 어떤거?
    }
}