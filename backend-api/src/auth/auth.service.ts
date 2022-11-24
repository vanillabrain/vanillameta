import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { NestFactory } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInfo } from 'src/user/entities/user-info.entity';
import { RefreshToken } from './entites/refresh_token.entity';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepository: Repository<RefreshToken>,
    ){}

    async generateAccessToken(user_id: string) {
            const accesstoken = await this.jwtService.sign({email: user_id}, {
                secret: process.env.ACCESS_SECRET,
                expiresIn: `600s`
            })
            return accesstoken
        // accesstoken이 없을때
    }

    async generateRefreshToken(user_id: string) {
        const refreshtoken = await this.jwtService.sign({user_id: user_id}, { secret: process.env.REFRESH_SECRET, expiresIn: "3600s" })
        return refreshtoken
        // accesstoken이 없을때
    }

    async setRefreshKey(refreshToken: string, user_id: string){
        const find_user = await this.refreshTokenRepository.findOne({ where: {user_id: user_id} });
        const token = refreshToken.replace('Bearer ', '');
        (!find_user) ?
            await this.refreshTokenRepository.save({
                user_id: user_id,
                refreshToken: token
        }) :
            find_user.refreshToken = token;
            await this.refreshTokenRepository.save(find_user)
        if(!find_user){

        } else {
            await this
        }

        // 로그인시 갱신된 refreshToken 저장
    }

    async validateUser(username: string, pass: string) {
        const user = await this.userInfoRepository.findOne({ where: { user_id: username } });
        if (user && user.password === pass) {
            delete user.password;
            return user;
        }
        // 로그인시 회원인지 확인
    }

    async deleteRefreshToken(Token: string) {
        const token = Token.replace('Bearer ', '');
        console.log(token)
        const refreshTokenInfo = await this.refreshTokenRepository.findOne({
            where: { refreshToken: token },
        });
        console.log(refreshTokenInfo)
        await this.refreshTokenRepository.delete(refreshTokenInfo);

    }
}
