import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserMapping) private readonly userMappingRepository: Repository<UserMapping>,
    private authService: AuthService,
  ) {}

  async findOne(userId: number) {
    console.log('findOne 호출됨, userId:', userId);
    const userData = await this.userRepository.findOne({
      where: { id: userId },
    });
    console.log('조회된 사용자 데이터:', userData);
    if (!userData) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    } else {
      delete userData.password;
      return { data: userData, message: 'success' };
    }
  }

  async updateUserInfo(userId: string, updateUserDto: UpdateUserDto) {
    const hashPassword = crypto
      .createHash('sha512')
      .update(String(updateUserDto.password))
      .digest('hex');
    const findUser = await this.authService.checkAccess(userId, hashPassword);
    if (!findUser) {
      throw new HttpException('not exist user', HttpStatus.CONFLICT);
    } else {
      const newHashPassword = crypto
        .createHash('sha512')
        .update(String(updateUserDto.new_password))
        .digest('hex');
      findUser.email = String(updateUserDto.email);
      findUser.password = newHashPassword;
      await this.userRepository.save(findUser);
      return `success`;
    }
  }

  async deleteUser(userId: string, password: string) {
    const hashPassword = crypto
      .createHash('sha512')
      .update(String(password))
      .digest('hex');
    const findUser = await this.authService.checkAccess(userId, hashPassword);
    if (findUser) {
      await this.userRepository.delete(findUser);
    }
    return `success`;
  }

  async reissuanceAccessToken(refreshKey) {
    const findUserKey = await this.authService.checkRefreshTokenKey(refreshKey);
    if (!findUserKey) {
      throw new UnauthorizedException();
    }
    const findUser = await this.userRepository.findOne({
      where: { jwtId: findUserKey.jwtId },
    });
    const accessToken = this.authService.generateAccessToken(findUser);
    return accessToken;
  }

  async findDashboardId(id: number) {
    const list = await this.userMappingRepository.find({
      where: { userId: id },
    });
    const dashboardIds = [];
    list.map(e => {
      if (e.dashboardId) {
        dashboardIds.push(e.dashboardId);
      }
    });
    return dashboardIds;
  }
}