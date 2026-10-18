import { ConflictException } from '@nestjs/common';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity.js';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';

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

  private async lockedAccount(manager: EntityManager, userId: string, password: string) {
    const user = await manager.findOne(User, {
      where: { userId },
      ...(['mysql', 'mariadb'].includes(manager.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    return user && user.active !== false && verifyPassword(password, user.password).ok
      ? user
      : null;
  }

  async updateUserInfo(userId: string, updateUserDto: UpdateUserDto) {
    try {
      return await metadataTransaction(this.userRepository.manager, async manager => {
        const current = await this.lockedAccount(manager, userId, String(updateUserDto.password));
        if (!current) throw new HttpException('not exist user', HttpStatus.CONFLICT);
        // Update only the requested fields; a profile write cannot restore a stale active/epoch state.
        await manager.update(User, current.id, {
          email: String(updateUserDto.email),
          password: hashPassword(String(updateUserDto.new_password)),
        });
        return 'success';
      });
    } catch (error) {
      const code = error instanceof QueryFailedError && (error.driverError as any)?.code;
      if (
        code === 'ER_DUP_ENTRY' ||
        (code === 'SQLITE_CONSTRAINT' && /UNIQUE/i.test((error as any).driverError.message))
      )
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      throw error;
    }
  }

  async deleteUser(userId: string, password: string) {
    try {
      return await metadataTransaction(this.userRepository.manager, async manager => {
        const current = await this.lockedAccount(manager, userId, password);
        if (!current) return 'Unauthorized';
        if (await manager.findOneBy(EnterpriseMembership, { userId: current.id }))
          throw new ConflictException('조직 소속 계정은 조직 탈퇴 처리 후 삭제할 수 있습니다.');
        await manager.delete(User, current.id);
        return 'success';
      });
    } catch (error) {
      const code = error instanceof QueryFailedError && (error.driverError as any)?.code;
      if (
        [
          'ER_ROW_IS_REFERENCED',
          'ER_ROW_IS_REFERENCED_2',
          'ER_LOCK_DEADLOCK',
          'ER_LOCK_WAIT_TIMEOUT',
        ].includes(code) ||
        (code === 'SQLITE_CONSTRAINT' && /FOREIGN KEY/i.test((error as any).driverError.message))
      )
        throw new ConflictException('계정 연결이 변경되었습니다. 최신 소속을 확인해 주세요.');
      throw error;
    }
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
