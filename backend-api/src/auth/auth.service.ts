import {HttpException, HttpStatus, Injectable } from '@nestjs/common';
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

    async generateAccessToken(payload: any) {
            const accessKeyData = {
                user_id: payload.user_id,
                email: payload.email,
                id: payload.id
            }
            const accessToken = await this.jwtService.sign({accessKeyData}, {
                secret: process.env.ACCESS_SECRET,
                expiresIn: `600s`
            })
            return accessToken
        // accesstoken이 없을때
    }

    async generateRefreshToken(user_id: string) {
        const refreshToken = await this.jwtService.sign({user_id: user_id}, { secret: process.env.REFRESH_SECRET, expiresIn: "3600s" })
        return refreshToken
        // accesstoken이 없을때
    }

    async setRefreshKey(refreshToken: string, user_id: string){
        const findUser = await this.refreshTokenRepository.findOne({ where: {user_id: user_id} });
        const token = refreshToken.replace('Bearer ', '');
        (!findUser) ?
            await this.refreshTokenRepository.save({
                user_id: user_id,
                refreshToken: token
        }) :
            findUser.refreshToken = token;
            await this.refreshTokenRepository.save(findUser)

        // 로그인시 갱신된 refreshToken 저장
    }

    async validateUser(user_id: string, pass: string) {
        const user = await this.userInfoRepository.findOne({ where: { user_id: user_id } });
        if (user && user.password === pass) {
            delete user.password;
            return user;
        }

        // 회원이 존재하는지 확인
    }

    async deleteRefreshToken(Token: string) {
        const token = Token.replace('Bearer ', '');
        const refreshTokenInfo = await this.refreshTokenRepository.findOne({
            where: { refreshToken: token },
        });
        console.log(refreshTokenInfo)
        await this.refreshTokenRepository.delete(refreshTokenInfo);
    }

    async verifyAccessToken(Token: string) {
        try{
            const token = Token.replace('Bearer ', '');
            const secretKey = process.env.ACCESS_SECRET
            const findUser = await this.jwtService.verify(token, { secret: secretKey })
            return findUser
        } catch (err) {
            throw new HttpException({message: 'accessTokenExpired'}, HttpStatus.UNAUTHORIZED);
        }
    }
}