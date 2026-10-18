import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
@Entity('enterprise_group_delivery')
@Index('IDX_enterprise_group_delivery_group', ['groupId', 'organizationId', 'active'])
export class EnterpriseGroupDelivery {
  @PrimaryColumn({ type: 'integer' }) ownerId: number;
  @PrimaryColumn({ type: 'integer' }) organizationId: number;
  @PrimaryColumn({ type: 'integer' }) dashboardId: number;
  @PrimaryColumn({ type: 'integer' }) groupId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'boolean', default: false }) active: boolean;
  @Column({ type: 'boolean', default: false }) allowCopy: boolean;
}
