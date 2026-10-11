import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { randomBytes } from 'crypto';

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
        expiresIn: `21600s`,
      },
    );
    return accessToken;
    // accesstoken이 없을때
  }

  async generateUrlAccessToken(payload: { dashboardId: number; uuid: string }) {
    const accessToken = await this.jwtService.sign(
      { shareKeyData: { dashboardId: payload.dashboardId, uuid: payload.uuid } },
      {
        secret: process.env.URL_ACCESS_SECRET || process.env.ACCESS_SECRET,
        jwtid: randomBytes(12).toString('hex'),
      },
    );
    return accessToken;
    // accesstoken이 없을때
  }

  async readUrlAccessToken(token: string): Promise<any | null> {
    try {
      return await this.jwtService.verify(token, {
        secret: process.env.URL_ACCESS_SECRET || process.env.ACCESS_SECRET,
      });
    } catch {
      return null;
    }
  }

  async generateRefreshToken(payload: any) {
    const refreshKeyData = {
      userId: payload.userId,
      email: payload.email,
      id: payload.id,
    };
    const refreshToken = await this.jwtService.sign(
      { refreshKeyData },
      {
        secret: process.env.REFRESH_SECRET,
        expiresIn: '43200s',
        jwtid: randomBytes(12).toString('hex'),
      },
    );
    return refreshToken;
    // accesstoken이 없을때
  }

  async setRefreshKey(refreshToken: string, jwt_id: number, userId: number) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
    const findToken =
      Number.isSafeInteger(jwt_id) && jwt_id > 0
        ? await this.refreshTokenRepository.findOne({ where: { id: jwt_id } })
        : null;
    const token = refreshToken.replace('Bearer ', '');
    const saved = await this.refreshTokenRepository.save({
      ...(findToken || {}),
      refreshToken: token,
    });
    await this.userRepository.update(userId, { jwtId: saved.id });
    return saved;
    // 로그인시 갱신된 refreshToken 저장
  }

  async validateUser(userId: string, pass: string) {
    const user = await this.userRepository.findOne({ where: { userId: userId } });
    if (!user) return null;

    const { ok, needsRehash } = verifyPassword(pass, user.password);
    if (!ok) return null;

    // 레거시 sha512 해시 사용자는 로그인 성공 시점에 scrypt로 재해싱
    if (needsRehash) {
      user.password = hashPassword(pass);
      await this.userRepository.save(user);
    }
    delete user.password;
    return user;

    // 회원이 존재하는지 확인
  }

  async deleteRefreshToken(userId: number) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
    const refreshTokenInfo = await this.refreshTokenRepository.findOne({
      where: { id: userId },
    });
    if (!refreshTokenInfo) {
      throw new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
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
      const secretKey = process.env.REFRESH_SECRET;
      const decoded = await this.jwtService.verify(token, { secret: secretKey });
      const actor = decoded?.refreshKeyData;
      if (
        !Number.isSafeInteger(actor?.id) ||
        actor.id <= 0 ||
        typeof actor.userId !== 'string' ||
        !actor.userId
      ) {
        throw new Error('invalid refresh actor');
      }
      const user = await this.userRepository.findOne({
        where: { id: actor.id, userId: actor.userId },
      });
      if (!user || !Number.isSafeInteger(user.jwtId) || user.jwtId <= 0) {
        throw new Error('missing refresh session');
      }
      const stored = await this.refreshTokenRepository.findOne({ where: { id: user.jwtId } });
      if (!stored || stored.refreshToken !== token) throw new Error('revoked refresh session');
      decoded.refreshKeyData.jwtId = user.jwtId;
      return decoded;
    } catch (err) {
      throw new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED);
    }
  } // Refresh 토큰이 유효한지 확인

  async checkAccess(userId: string, password: string) {
    return await this.validateUser(userId, password);
  }
}
