import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
export type ResourceKind = 'source' | 'dashboard';
export type ResourceAction = 'read' | 'edit' | 'publish' | 'export';
export type ResourceRights = Record<ResourceAction, boolean>;
@Entity('enterprise_resource_grant')
@Index('IDX_enterprise_grant_recipient', ['recipientId', 'organizationId'])
export class EnterpriseResourceGrant {
  @PrimaryColumn({ type: 'varchar', length: 16 }) resourceKind: ResourceKind;
  @PrimaryColumn({ type: 'integer' }) resourceId: number;
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'boolean', default: false }) read: boolean;
  @Column({ type: 'boolean', default: false }) edit: boolean;
  @Column({ type: 'boolean', default: false }) publish: boolean;
  @Column({ type: 'boolean', default: false }) export: boolean;
}
