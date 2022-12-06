import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';

@Injectable()
export class LoginService {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { user_id, password } = loginDto;
    const findUser = await this.authService.validateUser(user_id, password);
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
      where: { userId: createLoginDto.user_id },
    });

    if (!userInfoEmail && !userInfoId) {
      const { email, password, user_id } = createLoginDto;
      const set_retoken = await this.refreshRepository.save({})
      const createUserInfo = await this.userRepository.save({
        email: email,
        password: password,
        user_id: user_id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return 'success';
    } else if (!userInfoEmail && userInfoId) {
      throw new HttpException('conflict user_id', HttpStatus.CONFLICT);
    }
    throw new HttpException('conflict email', HttpStatus.CONFLICT);
  }
}
