import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { SampleService } from '../sample/sample.service';
import { hashPassword } from '../utils/password.util';

@Injectable()
export class LoginService {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>,
    private readonly sampleService: SampleService,
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { userId, password } = loginDto;
    const findUser = await this.authService.validateUser(userId, password); // 요저의 존재여부 확인
    if (!findUser) {
      throw new UnauthorizedException(`Unauthorized`);
    }
    return findUser;
  }

  async signup(createLoginDto: CreateLoginDto) {
    const userInfoEmail = await this.userRepository.findOne({
      where: { email: createLoginDto.email },
    });
    const userInfoId = await this.userRepository.findOne({
      where: { userId: createLoginDto.userId },
    });

    if (!userInfoEmail && !userInfoId) {
      const { email, password, userId } = createLoginDto;
      const createUserInfo = await this.userRepository.save({
        email: email,
        password: hashPassword(password),
        userId: userId,
        jwtId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // 온보딩 샘플 자산 프로비저닝 — 실패해도 가입은 유지 (비동기 fire-and-forget)
      void this.sampleService.provisionForUser(createUserInfo.id);
      return 'success';
    } else if (!userInfoEmail && userInfoId) {
      throw new HttpException('conflict userId', HttpStatus.CONFLICT);
    }
    throw new HttpException('conflict email', HttpStatus.CONFLICT);
  }
}
