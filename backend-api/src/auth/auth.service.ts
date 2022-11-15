import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { NestFactory } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        @InjectRepository(User) private readonly userRepository: Repository<User> ){}

    async generateAccessToken(email: string) {
        console.log(email)
            const accesstoken = await this.jwtService.sign({email: email}, {
                secret: process.env.ACCESS_SECRET,
                expiresIn: `30s`
            })
            return accesstoken
        // accesstoken이 없을때
    }

    async generateRefreshToken(email: string) {
        const refreshtoken = await this.jwtService.sign({email: email}, { secret: process.env.REFRESH_SECRET, expiresIn: "3600s" })
        return refreshtoken
        // accesstoken이 없을때
    }

    async setRefreshKey(){

    }

    async validateUser(email: string, pass: string) {
        const user = await this.userRepository.findOne({ where: { email: email } });
        if (user && user.password === pass) {
            delete user.password;
            return user;
        }
    }
}
