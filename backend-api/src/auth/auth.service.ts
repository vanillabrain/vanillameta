import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from './entities/refresh_token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const accessKeyData: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };

    const accessToken = await this.jwtService.sign(
      { accessKeyData },
      {
        secret: process.env.ACCESS_SECRET,
        expiresIn: `21600s`,
      },
    );
    return accessToken;
  }

  async generateUrlAccessToken(payload: JwtPayload): Promise<string> {
    const accessKeyData: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const accessToken = await this.jwtService.sign(
      { accessKeyData },
      {
        secret: process.env.URL_ACCESS_SECRET || process.env.ACCESS_SECRET,
      },
    );
    return accessToken;
  }

  async generateRefreshToken(payload: JwtPayload): Promise<string> {
    const refreshKeyData: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const refreshToken = await this.jwtService.sign(
      { refreshKeyData },
      { secret: process.env.REFRESH_SECRET, expiresIn: '43200s' },
    );
    return refreshToken;
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
    const user = await this.userRepository.findOne({
      where: { userId: userId },
      select: ['id', 'userId', 'email', 'password', 'status', 'name', 'jwtId'], // password 필드를 명시적으로 포함
    });

    if (user && user.password === pass) {
      delete user.password;
      return user;
    }
    return undefined;
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
