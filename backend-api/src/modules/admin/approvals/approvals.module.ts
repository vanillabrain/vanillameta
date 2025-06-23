import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { User } from '../../../user/entities/user.entity';
import { UserApproval } from '../entities/user-approval.entity';
import { Role } from '../entities/role.entity';
import { EmailService } from '../../../common/services/email.service';
import { NotificationService } from '../../../common/services/notification.service';
import { AuditLogService } from '../audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserApproval, Role, AuditLog]),
  ],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsService,
    EmailService,
    NotificationService,
    AuditLogService,
  ],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}