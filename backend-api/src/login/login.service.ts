import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { UserInfo } from 'src/user/entities/user-info.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';


@Injectable()
export class LoginService {
  constructor(
      private authService: AuthService,
      @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
      @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
  }

  async signin( loginDto: LoginUserDto ) {
    const { user_id, password } = loginDto;
    const findUser = await this.authService.validateUser(user_id, password);
    if (!findUser) {
      throw new UnauthorizedException(`Unauthorized`);
    }
    return findUser
  }

  async signup(createLoginDto: CreateLoginDto) {
    const userInfoEmail = await this.userInfoRepository.findOne({
      where: { email: createLoginDto.email }
    });
    const userInfoId = await this.userInfoRepository.findOne({
      where: { user_id: createLoginDto.user_id }
    });

    if(!userInfoEmail && !userInfoId){
      const { email, password, user_id } = createLoginDto;
      const createUserInfo = await this.userInfoRepository.save({
        email: email,
        password: password,
        user_id: user_id
      });

      return 'success';
    } else if (!userInfoEmail && userInfoId){
      return "conflict user_id"
    }
    return 'conflict email'
  }
}
