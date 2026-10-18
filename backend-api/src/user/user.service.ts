import { ConflictException } from '@nestjs/common';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity.js';
import { hashPassword } from '../utils/password.util';
import { serializeMetadataWork } from '../common/metadata-work';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserMapping) private readonly userMappingRepository: Repository<UserMapping>,
    private authService: AuthService,
  ) {}

  async findOne(userId: number) {
    return serializeMetadataWork(this.userRepository.manager.connection, async () => {
      const userData = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (!userData) {
        return 'Bad Request';
      } else {
        delete userData.password;
        return { data: userData, message: 'success' };
      }
    });
  }

  async updateUserInfo(userId: string, updateUserDto: UpdateUserDto) {
    // NFR005/008: the password check and the account rewrite share one metadata scope, so a
    // concurrent SQLite rollback cannot absorb an acknowledged change. checkAccess re-enters the
    // same DataSource scope instead of waiting on itself.
    return serializeMetadataWork(this.userRepository.manager.connection, async () => {
      const findUser = await this.authService.checkAccess(userId, String(updateUserDto.password));
      if (!findUser) {
        throw new HttpException('not exist user', HttpStatus.CONFLICT);
      } else {
        findUser.email = String(updateUserDto.email);
        findUser.password = hashPassword(String(updateUserDto.new_password));
        await this.userRepository.save(findUser);
        return 'success';
      }
    });
  }

  async deleteUser(userId: string, password: string) {
    return serializeMetadataWork(this.userRepository.manager.connection, async () => {
      const findUser = await this.authService.checkAccess(userId, password);
      if (!findUser) {
        return 'Unauthorized';
      } else {
        if (
          await this.userRepository.manager.findOneBy(EnterpriseMembership, { userId: findUser.id })
        )
          throw new ConflictException('조직 소속 계정은 조직 탈퇴 처리 후 삭제할 수 있습니다.');
        await this.userRepository.delete(findUser.id);
        return 'success';
      }
    });
  }

  async reissuanceAccessToken(userId: string, authVersion = 0) {
    const payload = await serializeMetadataWork(this.userRepository.manager.connection, () =>
      this.userRepository.findOne({ where: { userId: userId } }),
    );
    if (
      !payload ||
      payload.active === false ||
      !Number.isSafeInteger(authVersion) ||
      authVersion !== (payload.authVersion ?? 0)
    )
      throw new UnauthorizedException('refreshTokenExpired');
    return await this.authService.generateAccessToken(payload);
  }
  // AccessToken 만료시 재발급 코드

  async saveDashboard(dashboardId: number, userInfoId: number) {
    const saveObj = {
      dashboardId: dashboardId,
      userInfoId: userInfoId,
    };
    await serializeMetadataWork(this.userMappingRepository.manager.connection, () =>
      this.userMappingRepository.save(saveObj),
    );
  }
  // mapping table 대시보드id, 유저id 저장

  async findDashboardId(id: number) {
    return serializeMetadataWork(this.userMappingRepository.manager.connection, async () => {
      const findDashboard = await this.userMappingRepository
        .createQueryBuilder('user_mapping')
        .select('dashboardId')
        .where('user_mapping.userInfoId = :userInfoId', { userInfoId: id })
        .getRawMany();
      return findDashboard;
    });
  }
  // 대시보드id찾는 코드
}
