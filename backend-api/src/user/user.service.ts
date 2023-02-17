import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity.js';
const crypto = require('crypto');

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserMapping) private readonly userMappingRepository: Repository<UserMapping>,
    private authService: AuthService,
  ) {}

  async findOne(userId: number) {
    const userData = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!userData) {
      return 'Bad Request';
    } else {
      delete userData.password;
      return { data: userData, message: 'success' };
    }
  }

  async updateUserInfo(userId: string, updateUserDto: UpdateUserDto) {

    const hashPassword = crypto.createHash('sha512').update(String(updateUserDto.password)).digest('hex');
    const findUser = await this.authService.checkAccess(userId, hashPassword);
    if (!findUser) {
      throw new HttpException('not exist user', HttpStatus.CONFLICT);
    } else {

      const newHashPassword = crypto.createHash('sha512').update(String(updateUserDto.new_password)).digest('hex');
      findUser.email = String(updateUserDto.email);
      findUser.password = newHashPassword;
      await this.userRepository.save(findUser);
      return `success`;
    }
  }

  async deleteUser(userId: string, password: string) {
    const findUser = await this.authService.checkAccess(userId, password);
    if (!findUser) {
      return 'Unauthorized';
    } else {
      await this.userRepository.delete(findUser.id);
      return `success`;
    }
  }

  async reissuanceAccessToken(userId: string) {
    const payload = await this.userRepository.findOne({ where: { userId: userId } });
    return await this.authService.generateAccessToken(payload);
  }
  // AccessToken 만료시 재발급 코드

  async saveDashboard(dashboardId: number, userInfoId: number) {
    const saveObj = {
      dashboardId: dashboardId,
      userInfoId: userInfoId,
    };
    await this.userMappingRepository.save(saveObj);
  }
  // mapping table 대시보드id, 유저id 저장

  async findDashboardId(id: number) {
    const findDashboard = await this.userMappingRepository
      .createQueryBuilder('user_mapping')
      .select('dashboardId')
      .where('user_mapping.userInfoId = :userInfoId', { userInfoId: id })
      .getRawMany();
    return findDashboard;
  }
  // 대시보드id찾는 코드
}
