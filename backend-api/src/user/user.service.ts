import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInfo } from './entities/user-info.entity';
import { User } from './entities/user.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';

@Injectable()
export class UserService {
  constructor(
  @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
  private authService: AuthService,
  ) {}

  async signin( loginDto: UpdateUserDto ) {
    const { user_id, password } = loginDto;
    const findUser = await this.authService.validateUser(user_id, password);
    if (!findUser) {
      throw new UnauthorizedException(`Unauthorized`);
    }
    return findUser
  }

  async signup(createUserDto: CreateUserDto) {
    const userInfoEmail = await this.userInfoRepository.findOne({
      where: { email: createUserDto.email }
    });
    const userInfoId = await this.userInfoRepository.findOne({
      where: { user_id: createUserDto.user_id }
    });

    if(!userInfoEmail && !userInfoId){
      const { email, password, user_id } = createUserDto;
      const createUserInfo = await this.userInfoRepository.save({
        email: email,
        password: password,
        user_id: user_id
      });
      await this.userRepository.save({ user_info_id: createUserInfo.id});

      return 'success';
    } else if (!userInfoEmail && userInfoId){
      return "conflict user_id"
    }
    return 'conflict email'
  }

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
    const { accessKeyData } = await this.authService.verifyAccessToken(accessToken)
    const findUser = await this.authService.validateUser( accessKeyData.user_id, accessKeyData.password );

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
    const { accessKeyData } = await this.authService.verifyAccessToken(accessToken)
    const findUser = await this.authService.validateUser(accessKeyData.user_id, password);
    if(!findUser){
      return 'Unauthorized'
    } else {
      await this.userInfoRepository.delete(findUser.id)
      return `success`;
    }
  }

  async checkShareUrl( accessToken:string, dashboard_id: number ) {
    const { accessKeyData } = await this.authService.verifyAccessToken(accessToken)
    const findUser = await this.authService.validateUser( accessKeyData.user_id, accessKeyData.password );
    if(!findUser){
      return 'not exist user'
    } else {
      const newToken = await this.authService.generateRefreshToken(String(dashboard_id)); //새로운 공유 토큰 생성
      const findDashboard = await this.dashboardRepository.findOne( {where: { id: dashboard_id } })
      findDashboard.shareToken = newToken;
      await this.dashboardRepository.save(findDashboard)
      return { Token: findDashboard.shareToken, message: "success" }
    }
  }

  async reissuanceAccessToken(cookie: string){
    const tokenInfo = await this.authService.verifyRefreshToken(cookie)
    const payload = await this.userInfoRepository.findOne({ where: { user_id: tokenInfo.user_id }})
    return await this.authService.generateAccessToken(payload)

  }

}
