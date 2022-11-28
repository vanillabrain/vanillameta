import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInfo } from './entities/user-info.entity';
import { User } from './entities/user.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { YesNo } from '../common/enum/yn.enum.js';

@Injectable()
export class UserService {
  constructor(
  @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  private authService: AuthService,
  ) {}

  async findOne(accessToken: string) {
    const findUser = await this.authService.verifyAccessToken(accessToken)
    const { accessKeyData } = findUser;
    const userData = await this.userInfoRepository.findOne({
      where: { user_id: accessKeyData.user_id }
    });
    if(!userData){
      return 'Bad Request'
    } else {
      delete userData.password;
      return { data: userData, message: "success" }
    }
  }

  async updateUserInfo(accessToken: string, updateUserDto: UpdateUserDto) {
    const findUser = await this.authService.checkAccess(accessToken, updateUserDto.password);
    if(!findUser){
      return 'not exist user';
    } else {
      findUser.email = String(updateUserDto.email);
      findUser.password = String(updateUserDto.password);
      await this.userInfoRepository.save(findUser);
      return `This action update_name a #${findUser.user_id} user`;
    }
  }

  async deleteUser( accessToken:string, password: string ) {
    const findUser = await this.authService.checkAccess(accessToken, password);
    if(!findUser){
      return 'Unauthorized'
    } else {
      await this.userInfoRepository.delete(findUser.id)
      return `success`;
    }
  }

  async reissuanceAccessToken(cookie: string){
    const tokenInfo = await this.authService.verifyRefreshToken(cookie)
    const payload = await this.userInfoRepository.findOne({ where: { user_id: tokenInfo.user_id }})
    return await this.authService.generateAccessToken(payload)
  }

}
