import { EnterpriseClassificationService } from './classification.service';
import { EnterpriseClassificationController } from './classification.controller';
import {
  EnterpriseClassification,
  EnterpriseClassificationRequest,
} from './entities/enterprise-classification.entity';
import { DashboardLifecycleService } from './dashboard-lifecycle.service';
import { DashboardLifecycleController } from './dashboard-lifecycle.controller';
import { DashboardLifecycleReceipt } from './entities/dashboard-lifecycle-receipt.entity';
import { EnterpriseGroupDeliveryService } from './group-delivery.service';
import { EnterpriseGroupService } from './group.service';
import { EnterpriseGroupController } from './group.controller';
import { EnterpriseDeliveryController } from './delivery.controller';
import { EnterpriseDeliveryService } from './delivery.service';
import { EnterpriseNotificationService } from './notification.service';
import { EnterpriseNotificationController } from './notification.controller';
import { SourceLifecycleService } from './source-lifecycle.service';
import { EnterpriseResourceController } from './resource-policy.controller';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnterpriseClassification,
      EnterpriseClassificationRequest,
      DashboardLifecycleReceipt,
      EnterpriseEnrollment,
      EnterpriseOrganization,
      EnterpriseMembership,
      EnterpriseAuditEvent,
    ]),
  ],
  controllers: [
    EnterpriseClassificationController,
    DashboardLifecycleController,
    EnterpriseGroupController,
    EnterpriseController,
    EnterpriseResourceController,
    EnterpriseNotificationController,
    EnterpriseDeliveryController,
  ],
  providers: [
    EnterpriseClassificationService,
    DashboardLifecycleService,
    EnterpriseGroupService,
    EnterpriseDeliveryService,
    EnterpriseGroupDeliveryService,
    EnterpriseNotificationService,
    SourceLifecycleService,
    EnterpriseService,
    JwtService,
  ],
})
export class EnterpriseModule {}
