import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { ApprovalsModule } from './approvals/approvals.module';
import { User } from '../../user/entities/user.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { AnalyticsEvent } from '../../analytics/entities/analytics-event.entity';
import { Role } from './entities/role.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UserApproval } from './entities/user-approval.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Dashboard,
      Widget,
      AnalyticsEvent,
      Role,
      AuditLog,
      UserApproval,
    ]),
    ApprovalsModule,
  ],
  controllers: [AdminController, AdminUsersController, RoleController, AuditLogController],
  providers: [AdminService, AdminUsersService, RoleService, AuditLogService],
  exports: [AdminService, AdminUsersService, RoleService, AuditLogService],
})
export class AdminModule {}