import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async generateAccessToken(payload: any) {
    const accessKeyData = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const accessToken = await this.jwtService.sign(
      { accessKeyData },
      {
        secret: process.env.ACCESS_SECRET,
        expiresIn: `10800s`,
      },
    );
    return accessToken;
    // accesstoken이 없을때
  }

  async generateUrlAccessToken(payload: any) {
    const accessKeyData = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const accessToken = await this.jwtService.sign(
      { accessKeyData },
      {
        // secret: process.env.URL_ACCESS_SECRET,
        secret: 'test1234',
        expiresIn: `10800s`,
      },
    );
    return accessToken;
    // accesstoken이 없을때
  }

  async generateRefreshToken(payload: any) {
    const refreshKeyData = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const refreshToken = await this.jwtService.sign(
      { refreshKeyData },
      { secret: process.env.REFRESH_SECRET, expiresIn: '212600s' },
    );
    return refreshToken;
    // accesstoken이 없을때
  }

  async setRefreshKey(refreshToken: string, jwt_id: number) {
    const findToken = await this.refreshTokenRepository.findOne({ where: { id: jwt_id } });
    const token = refreshToken.replace('Bearer ', '');
    if (!findToken) {
      return await this.refreshTokenRepository.save({
        refreshToken: token,
      });
    } else {
      findToken.refreshToken = token;
      await this.refreshTokenRepository.save(findToken);
    }
    // 로그인시 갱신된 refreshToken 저장
  }

  async validateUser(userId: string, pass: string) {
    const user = await this.userRepository.findOne({ where: { userId: userId } });
    if (user && user.password === pass) {
      delete user.password;
      return user;
    }

    // 회원이 존재하는지 확인
  }

  async deleteRefreshToken(userId: number) {
    const refreshTokenInfo = await this.refreshTokenRepository.findOne({
      where: { id: userId },
    });
    refreshTokenInfo.refreshToken = '';
    await this.refreshTokenRepository.save(refreshTokenInfo);
  }

  async verifyAccessToken(token: string) {
    try {
      const Token = token.replace('Bearer ', '');
      const secretKey = process.env.ACCESS_SECRET;
      const findUser = await this.jwtService.verify(Token, { secret: secretKey });
      return findUser;
    } catch (err) {
      throw new HttpException({ message: 'accessTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
  } // Access 토큰이 유효한지 확인

  async verifyRefreshToken(token: string) {
    try {
      const Token = token.replace('Bearer ', '').split('=')[1];
      const secretKey = process.env.REFRESH_SECRET;
      const findUser = await this.jwtService.verify(Token, { secret: secretKey });
      return findUser;
    } catch (err) {
      throw new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
  } // Refresh 토큰이 유효한지 확인

  async checkAccess(userId: string, password: string) {
    return await this.validateUser(userId, password);
  }
}
