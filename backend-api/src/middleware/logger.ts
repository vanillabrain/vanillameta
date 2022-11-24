import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { UserController } from 'src/user/user.controller';


@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {

        console.log(`${req.headers.host}/${req.originalUrl}/${req.method}`)
        console.log(res)
        // 로그인 시간, 로그아웃 체크, 접속기기..?, explorer 어떤거?
        next();
    }
}