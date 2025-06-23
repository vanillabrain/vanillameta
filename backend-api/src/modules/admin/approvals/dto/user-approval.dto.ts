import { ApiProperty } from '@nestjs/swagger';
import { UserApproval, ApprovalStatus } from '../../entities/user-approval.entity';

export class UserApprovalDto {
  @ApiProperty({ description: '승인 요청 ID' })
  id: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '사용자 정보' })
  user: {
    id: number;
    userId: string;
    email: string;
    name: string;
    createdAt: Date;
  };

  @ApiProperty({ description: '가입 신청 메모' })
  applicationNote: string;

  @ApiProperty({ description: '승인 상태' })
  status: ApprovalStatus;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  constructor(approval: UserApproval) {
    this.id = approval.id;
    this.userId = approval.userId;
    this.user = {
      id: approval.user.id,
      userId: approval.user.userId,
      email: approval.user.email,
      name: approval.user.name,
      createdAt: approval.user.createdAt,
    };
    this.applicationNote = approval.applicationNote;
    this.status = approval.status;
    this.createdAt = approval.createdAt;
  }
}

export class UserApprovalDetailDto extends UserApprovalDto {
  @ApiProperty({ description: '검토 메모' })
  reviewNote?: string;

  @ApiProperty({ description: '거부 사유' })
  rejectionReason?: string;

  @ApiProperty({ description: '검토자 정보' })
  reviewer?: {
    id: number;
    name: string;
    email: string;
  };

  @ApiProperty({ description: '검토일' })
  reviewedAt?: Date;

  constructor(approval: UserApproval) {
    super(approval);
    this.reviewNote = approval.reviewNote;
    this.rejectionReason = approval.rejectionReason;
    if (approval.reviewer) {
      this.reviewer = {
        id: approval.reviewer.id,
        name: approval.reviewer.name,
        email: approval.reviewer.email,
      };
    }
    this.reviewedAt = approval.reviewedAt;
  }
}