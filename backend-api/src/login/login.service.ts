import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entities/refresh_token.entity';
import * as crypto from 'crypto';

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
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return findUser;
  }

  async signup(createLoginDto: CreateLoginDto) {
    // N+1 쿼리 방지: OR 조건을 사용하여 한 번의 쿼리로 email과 userId 중복 체크
    const existingUser = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: createLoginDto.email })
      .orWhere('user.userId = :userId', { userId: createLoginDto.userId })
      .getOne();

    if (!existingUser) {
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
    } else if (existingUser.userId === createLoginDto.userId) {
      throw new HttpException('conflict userId', HttpStatus.CONFLICT);
    } else {
      throw new HttpException('conflict email', HttpStatus.CONFLICT);
    }
  }
}
