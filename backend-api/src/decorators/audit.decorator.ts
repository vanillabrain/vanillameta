import { SetMetadata } from '@nestjs/common';
import { AuditLogCategory } from '../entities/audit-log.entity';

export interface AuditConfig {
  action: string;
  resourceType?: string;
  category?: AuditLogCategory;
}

export const Audit = (config: AuditConfig) => SetMetadata('audit', config);