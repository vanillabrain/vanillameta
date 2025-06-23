import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { GetUsersQueryDto, UserResponseDto, ApproveUserDto, RejectUserDto } from './dto/admin-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUsers(query: GetUsersQueryDto) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = query;

      const qb = this.userRepository.createQueryBuilder('user');

      // 검색 기능
      if (search) {
        qb.where('user.email LIKE :search OR user.userId LIKE :search', {
          search: `%${search}%`
        });
      }

      // 비밀번호 필드 제외
      qb.select([
        'user.id',
        'user.userId',
        'user.email',
        'user.createdAt',
        'user.updatedAt'
      ]);

      // 정렬
      qb.orderBy(`user.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // 페이지네이션
      const offset = (page - 1) * limit;
      qb.skip(offset).take(limit);

      const [users, total] = await qb.getManyAndCount();

      return {
        data: users.map(user => this.mapToUserResponseDto(user)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<UserResponseDto> {
    try {
      const userId = parseInt(id, 10);
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'userId', 'email', 'createdAt', 'updatedAt']
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      return this.mapToUserResponseDto(user);
    } catch (error) {
      console.error('Error getting user by id:', error);
      throw error;
    }
  }

  async updateUserStatus(id: string, status: string): Promise<UserResponseDto> {
    try {
      const userId = parseInt(id, 10);
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 현재 User 엔티티에 status 필드가 없으므로
      // 향후 확장을 위한 플레이스홀더
      // TODO: User 엔티티에 status 필드 추가 시 실제 업데이트 구현

      console.log(`User ${id} status change requested to: ${status}`);

      return this.mapToUserResponseDto(user);
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async getUserStats() {
    try {
      const total = await this.userRepository.count();
      
      // 최근 30일 신규 가입자
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsers = await this.userRepository.count({
        where: {
          createdAt: MoreThanOrEqual(thirtyDaysAgo)
        }
      });

      return {
        totalUsers: total,
        recentUsers,
        // 임시 값들 (실제 status 필드가 없으므로)
        activeUsers: Math.floor(total * 0.8),
        inactiveUsers: Math.floor(total * 0.2),
        pendingUsers: 0,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalUsers: 0,
        recentUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        pendingUsers: 0,
      };
    }
  }

  /**
   * 승인 대기 중인 사용자 목록 조회
   * YOLO 모드: 최근 7일 내 가입한 사용자를 승인 대기로 간주
   */
  async getPendingUsers(query: GetUsersQueryDto) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = query;

      // 최근 7일 내 가입한 사용자를 승인 대기로 간주
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const qb = this.userRepository.createQueryBuilder('user');

      // 최근 7일 내 가입한 사용자 필터
      qb.where('user.createdAt >= :sevenDaysAgo', { sevenDaysAgo });

      // 검색 기능
      if (search) {
        qb.andWhere('(user.email LIKE :search OR user.userId LIKE :search)', {
          search: `%${search}%`
        });
      }

      // 비밀번호 필드 제외
      qb.select([
        'user.id',
        'user.userId',
        'user.email',
        'user.createdAt',
        'user.updatedAt'
      ]);

      // 정렬
      qb.orderBy(`user.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // 페이지네이션
      const offset = (page - 1) * limit;
      qb.skip(offset).take(limit);

      const [users, total] = await qb.getManyAndCount();

      return {
        data: users.map(user => this.mapToPendingUserResponseDto(user)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting pending users:', error);
      throw error;
    }
  }

  /**
   * 사용자 승인
   */
  async approveUser(id: string, approveDto: ApproveUserDto): Promise<UserResponseDto> {
    try {
      const userId = parseInt(id, 10);
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // YOLO 모드: 실제 상태 업데이트는 향후 구현 예정
      // 현재는 로그만 남김
      console.log(`✅ 사용자 승인: ${user.email} (ID: ${id})`);
      console.log(`승인 사유: ${approveDto.reason || '사유 없음'}`);

      return this.mapToUserResponseDto(user);
    } catch (error) {
      console.error('Error approving user:', error);
      throw error;
    }
  }

  /**
   * 사용자 거부
   */
  async rejectUser(id: string, rejectDto: RejectUserDto): Promise<UserResponseDto> {
    try {
      const userId = parseInt(id, 10);
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // YOLO 모드: 실제 상태 업데이트는 향후 구현 예정
      // 현재는 로그만 남김
      console.log(`❌ 사용자 거부: ${user.email} (ID: ${id})`);
      console.log(`거부 사유: ${rejectDto.reason}`);

      return this.mapToUserResponseDto(user);
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw error;
    }
  }

  private mapToUserResponseDto(user: User): UserResponseDto {
    return {
      id: user.id.toString(),
      userId: user.userId,
      email: user.email,
      // 임시 값들 (실제 필드가 없으므로)
      name: user.userId, // userId를 name으로 사용
      status: 'active', // 기본값
      roles: ['user'], // 기본 역할
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: null, // 추후 구현
    };
  }

  private mapToPendingUserResponseDto(user: User): UserResponseDto {
    return {
      id: user.id.toString(),
      userId: user.userId,
      email: user.email,
      // 임시 값들 (실제 필드가 없으므로)
      name: user.userId, // userId를 name으로 사용
      status: 'pending', // 승인 대기 상태
      roles: ['user'], // 기본 역할
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: null, // 추후 구현
    };
  }
}