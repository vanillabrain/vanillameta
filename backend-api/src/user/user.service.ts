import {HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import {getConnection, getConnectionManager, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { YesNo } from '../common/enum/yn.enum.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

@Injectable()
export class UserService {
  constructor(
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  @InjectRepository(UserMapping) private readonly userMappingRepository: Repository<UserMapping>,
  private authService: AuthService,
  ) {}

  async findOne(accessToken: string) {
    const findUser = await this.authService.verifyAccessToken(accessToken)
    const { accessKeyData } = findUser;
    const userData = await this.userRepository.findOne({
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
      throw new HttpException('not exist user', HttpStatus.CONFLICT);
    } else {
      findUser.email = String(updateUserDto.email);
      findUser.password = String(updateUserDto.new_password);
      await this.userRepository.save(findUser);
      return `success`;
    }
  }

  async deleteUser( accessToken:string, password: string ) {
    const findUser = await this.authService.checkAccess(accessToken, password);
    if(!findUser){
      return 'Unauthorized'
    } else {
      await this.userRepository.delete(findUser.id)
      return `success`;
    }
  }

  async reissuanceAccessToken(cookie: string){
    const tokenInfo = await this.authService.verifyRefreshToken(cookie)

    const { user_id } = tokenInfo.refreshKeyData
    const payload = await this.userRepository.findOne({ where: { user_id: user_id }})
    return await this.authService.generateAccessToken(payload)
  }

  async saveDashboard(dashboardId: number, userInfoId: number) {
    const saveObj = {
      dashboard_id: dashboardId,
      user_info_id: userInfoId
    }
    await this.userMappingRepository.save(saveObj)
  }

  async findDashboardId(accesstoken: string){
    const findUser = await this.authService.verifyAccessToken(accesstoken)
    const { accessKeyData } = findUser;
    const findDashboard = await this.userMappingRepository
        .createQueryBuilder('user_mapping')
        .select("dashboard_id")
        .where('user_mapping.user_info_id = :user_info_id', { user_info_id: accessKeyData.id }).getRawMany()
    return findDashboard
  }
}
