import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entities/refresh_token.entity';
import {
  UnauthorizedException,
  DuplicateException,
} from 'src/common/exceptions/business.exception';
import { I18nService } from 'nestjs-i18n';
const crypto = require('crypto');

@Injectable()
export class LoginService {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>,
    private readonly i18n: I18nService,
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { userId, password } = loginDto;
    // const salt = crypto.randomBytes(128).toString('base64');
    const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
    console.log(hashPassword);
    const findUser = await this.authService.validateUser(userId, hashPassword); // 요저의 존재여부 확인
    if (!findUser) {
      throw new UnauthorizedException('Invalid credentials');
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
      const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
      const createUserInfo = await this.userRepository.save({
        email: email,
        password: hashPassword,
        userId: userId,
        jwtId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { success: true, message: 'User created successfully' };
    } else if (!userInfoEmail && userInfoId) {
      throw new DuplicateException('User', 'userId', createLoginDto.userId);
    }
    throw new DuplicateException('User', 'email', createLoginDto.email);
  }
}
