import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
const crypto = require('crypto');

@Injectable()
export class LoginService {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>,
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { userId, password } = loginDto;
    // const salt = crypto.randomBytes(128).toString('base64');
    const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
    console.log(hashPassword);
    const findUser = await this.authService.validateUser(userId, hashPassword); // 요저의 존재여부 확인
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
      const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
      const createUserInfo = await this.userRepository.save({
        email: email,
        password: hashPassword,
        userId: userId,
        jwtId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return 'success';
    } else if (!userInfoEmail && userInfoId) {
      throw new HttpException('conflict userId', HttpStatus.CONFLICT);
    }
    throw new HttpException('conflict email', HttpStatus.CONFLICT);
  }
}
