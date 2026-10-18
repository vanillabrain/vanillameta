import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Global, Module } from '@nestjs/common';
import { SourceAccessService } from './source-access.service';
import { SourceOwnershipGuard } from './source-ownership.guard';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnterpriseGroup,
      EnterpriseGroupMember,
      EnterpriseGroupGrant,
      EnterpriseResourceGrant,
      EnterpriseDashboardDelivery,
    ]),
  ],
  providers: [EnterpriseResourcePolicyService, SourceAccessService, SourceOwnershipGuard],
  exports: [EnterpriseResourcePolicyService, SourceAccessService, SourceOwnershipGuard],
})
export class SourceOwnershipModule {}
