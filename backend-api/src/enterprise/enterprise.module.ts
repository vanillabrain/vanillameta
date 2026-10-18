import { HandoverTransferService } from './handover-transfer.service';
import { HandoverTransferController } from './handover-transfer.controller';
import { EnterpriseHandoverTransfer } from './entities/enterprise-handover-transfer.entity';
import { HandoverProposalService } from './handover-proposal.service';
import { HandoverProposalController } from './handover-proposal.controller';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { StaffDepartureImpactService } from './staff-departure-impact.service';
import { StaffDepartureImpactController } from './staff-departure-impact.controller';
import { StaffTransferService } from './staff-transfer.service';
import { StaffTransferController } from './staff-transfer.controller';
import { EnterpriseStaffTransfer } from './entities/enterprise-staff-transfer.entity';
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
      EnterpriseHandoverProposal,
      EnterpriseHandoverTransfer,
      EnterpriseStaffTransfer,
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
    HandoverProposalController,
    HandoverTransferController,
    StaffDepartureImpactController,
    StaffTransferController,
    EnterpriseClassificationController,
    DashboardLifecycleController,
    EnterpriseGroupController,
    EnterpriseController,
    EnterpriseResourceController,
    EnterpriseNotificationController,
    EnterpriseDeliveryController,
  ],
  providers: [
    HandoverProposalService,
    HandoverTransferService,
    StaffDepartureImpactService,
    StaffTransferService,
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
