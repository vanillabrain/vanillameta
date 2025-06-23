import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { RBACService } from './rbac.service';
import { PermissionGuard } from './guards/permission.guard';
import { ApprovalsModule } from './approvals/approvals.module';
import { User } from '../../user/entities/user.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { AnalyticsEvent } from '../../analytics/entities/analytics-event.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
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
      Permission,
      UserRole,
      AuditLog,
      UserApproval,
    ]),
    CacheModule.register(),
    ApprovalsModule,
  ],
  controllers: [AdminController, AdminUsersController, RoleController, AuditLogController],
  providers: [AdminService, AdminUsersService, RoleService, AuditLogService, RBACService, PermissionGuard],
  exports: [AdminService, AdminUsersService, RoleService, AuditLogService, RBACService, PermissionGuard],
})
export class AdminModule {}