import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('enterprise_dashboard_delivery')
@Index('IDX_enterprise_delivery_recipient', ['recipientId', 'organizationId', 'active'])
export class EnterpriseDashboardDelivery {
  @PrimaryColumn({ type: 'integer' }) ownerId: number;
  @PrimaryColumn({ type: 'integer' }) organizationId: number;
  @PrimaryColumn({ type: 'integer' }) dashboardId: number;
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'boolean', default: false }) active: boolean;
  @Column({ type: 'boolean', default: false }) allowCopy: boolean;
}

@Entity('enterprise_delivery_receipt')
export class EnterpriseDeliveryReceipt {
  @PrimaryColumn({ type: 'integer' }) ownerId: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 64 }) digest: string;
  @Column({ type: 'text' }) response: string;
}
