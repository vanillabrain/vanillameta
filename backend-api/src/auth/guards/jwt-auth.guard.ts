import {ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private jwtService: JwtService) {
        super();
    }
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const { cookie } = request.headers;
        if (cookie === undefined) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        const token = cookie.replace('Bearer ', '');
        const userInfo = await this.validate(token);
        if(userInfo) request.user = userInfo;
        return true;
        //TODO 바꿔야함
        // !!userInfo
    }

    async validate(payload: any) {
        const secretKey = process.env.REFRESH_SECRET
        return await this.jwtService.verify(payload, { secret: secretKey });
    }

}
