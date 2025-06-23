import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserStatus } from '../../../user/entities/user.entity';
import { UserApproval, ApprovalStatus } from '../entities/user-approval.entity';
import { Role } from '../entities/role.entity';
import { EmailService } from '../../../common/services/email.service';
import { AuditLogService } from '../audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { 
  GetPendingApprovalsQueryDto, 
  ApprovalStatsDto, 
  BulkApprovalResultDto,
  UserApprovalDto,
  UserApprovalDetailDto
} from './dto/approval-query.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { RejectUserDto } from './dto/reject-user.dto';
import { BulkApproveDto } from './dto/bulk-approve.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { AUDIT_ACTIONS } from '../dto/audit-log.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserApproval)
    private approvalRepository: Repository<UserApproval>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private emailService: EmailService,
    private auditLogService: AuditLogService,
    private notificationService: NotificationService,
  ) {}

  async getPendingApprovals(
    query: GetPendingApprovalsQueryDto,
  ): Promise<PaginatedResponseDto<UserApprovalDto>> {
    const qb = this.approvalRepository
      .createQueryBuilder('approval')
      .leftJoinAndSelect('approval.user', 'user')
      .where('approval.status = :status', { status: ApprovalStatus.PENDING });

    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.createdAfter) {
      qb.andWhere('approval.createdAt >= :createdAfter', {
        createdAfter: query.createdAfter,
      });
    }

    qb.orderBy('approval.createdAt', 'ASC'); // 오래된 순부터

    const [approvals, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      data: approvals.map(approval => new UserApprovalDto(approval)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getApprovalDetail(approvalId: string): Promise<UserApprovalDetailDto> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
      relations: ['user', 'reviewer'],
    });

    if (!approval) {
      throw new NotFoundException('승인 요청을 찾을 수 없습니다');
    }

    return new UserApprovalDetailDto(approval);
  }

  async approveUser(
    approvalId: string,
    approveDto: ApproveUserDto,
    reviewer: User,
  ): Promise<void> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
      relations: ['user'],
    });

    if (!approval) {
      throw new NotFoundException('승인 요청을 찾을 수 없습니다');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('이미 처리된 승인 요청입니다');
    }

    await this.userRepository.manager.transaction(async (manager) => {
      // 사용자 상태 활성화
      await manager.update(User, approval.userId, {
        status: UserStatus.ACTIVE,
      });

      // 승인 정보 업데이트
      await manager.update(UserApproval, approval.id, {
        status: ApprovalStatus.APPROVED,
        reviewNote: approveDto.reviewNote,
        reviewedBy: reviewer.id.toString(),
        reviewedAt: new Date(),
      });

      // 기본 역할 할당
      const defaultRole = await this.roleRepository.findOne({
        where: { name: approveDto.defaultRole || 'viewer' },
      });

      if (defaultRole) {
        await manager
          .createQueryBuilder()
          .relation(User, 'roles')
          .of(approval.userId)
          .add(defaultRole.id);
      }
    });

    // 승인 완료 이메일 발송
    await this.emailService.sendApprovalSuccessEmail(
      approval.user,
      approveDto.welcomeMessage,
    );

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: AUDIT_ACTIONS.USER_APPROVED,
      resourceType: 'User',
      resourceId: approval.userId,
      userId: reviewer.id.toString(),
      userEmail: reviewer.email,
      userName: reviewer.name,
      details: {
        reviewNote: approveDto.reviewNote,
        defaultRole: approveDto.defaultRole,
      },
    });
  }

  async rejectUser(
    approvalId: string,
    rejectDto: RejectUserDto,
    reviewer: User,
  ): Promise<void> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
      relations: ['user'],
    });

    if (!approval) {
      throw new NotFoundException('승인 요청을 찾을 수 없습니다');
    }

    await this.userRepository.manager.transaction(async (manager) => {
      // 승인 거부 정보 업데이트
      await manager.update(UserApproval, approval.id, {
        status: ApprovalStatus.REJECTED,
        rejectionReason: rejectDto.reason,
        reviewNote: rejectDto.reviewNote,
        reviewedBy: reviewer.id.toString(),
        reviewedAt: new Date(),
      });

      // 사용자 계정 삭제 (옵션)
      if (rejectDto.deleteAccount) {
        await manager.softDelete(User, approval.userId);
      }
    });

    // 거부 알림 이메일 발송
    await this.emailService.sendApprovalRejectionEmail(
      approval.user,
      rejectDto.reason,
    );

    // 감사 로그 기록
    await this.auditLogService.createAuditLog({
      action: AUDIT_ACTIONS.USER_REJECTED,
      resourceType: 'User',
      resourceId: approval.userId,
      userId: reviewer.id.toString(),
      userEmail: reviewer.email,
      userName: reviewer.name,
      details: {
        reason: rejectDto.reason,
        deleteAccount: rejectDto.deleteAccount,
      },
    });
  }

  async bulkApprove(
    bulkApproveDto: BulkApproveDto,
    reviewer: User,
  ): Promise<BulkApprovalResultDto> {
    const { approvalIds, defaultRole, welcomeMessage } = bulkApproveDto;
    
    const approvals = await this.approvalRepository.find({
      where: { id: In(approvalIds) },
      relations: ['user'],
    });

    const results: BulkApprovalResultDto = {
      successful: [],
      failed: [],
    };

    for (const approval of approvals) {
      try {
        if (approval.status === ApprovalStatus.PENDING) {
          await this.approveUser(
            approval.id,
            { defaultRole, welcomeMessage, reviewNote: '일괄 승인' },
            reviewer,
          );
          results.successful.push(approval.id);
        } else {
          results.failed.push({
            id: approval.id,
            reason: '이미 처리된 요청입니다',
          });
        }
      } catch (error) {
        results.failed.push({
          id: approval.id,
          reason: error.message,
        });
      }
    }

    return results;
  }

  async getApprovalStats(): Promise<ApprovalStatsDto> {
    const [pending, approved, rejected] = await Promise.all([
      this.approvalRepository.count({
        where: { status: ApprovalStatus.PENDING },
      }),
      this.approvalRepository.count({
        where: { status: ApprovalStatus.APPROVED },
      }),
      this.approvalRepository.count({
        where: { status: ApprovalStatus.REJECTED },
      }),
    ]);

    // 최근 7일간 승인 동향
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentApprovals = await this.approvalRepository
      .createQueryBuilder('approval')
      .select('DATE(approval.reviewedAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('approval.reviewedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('approval.status = :status', { status: ApprovalStatus.APPROVED })
      .groupBy('DATE(approval.reviewedAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
      recentTrend: recentApprovals,
    };
  }
}