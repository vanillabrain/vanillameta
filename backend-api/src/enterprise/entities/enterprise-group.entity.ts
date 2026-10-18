import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ResourceKind } from './enterprise-resource-grant.entity';
@Entity('enterprise_group')
@Index('UQ_enterprise_group_name', ['organizationId', 'nameKey'], { unique: true })
export class EnterpriseGroup {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 100 }) nameKey: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer' }) version: number;
}
@Entity('enterprise_group_member')
@Index('IDX_enterprise_group_member_user', ['userId', 'groupId'])
export class EnterpriseGroupMember {
  @PrimaryColumn({ type: 'integer' }) groupId: number;
  @PrimaryColumn({ type: 'integer' }) userId: number;
}
@Entity('enterprise_group_grant')
@Index('IDX_enterprise_group_grant_group', ['groupId', 'organizationId'])
export class EnterpriseGroupGrant {
  @PrimaryColumn({ type: 'varchar', length: 16 }) resourceKind: ResourceKind;
  @PrimaryColumn({ type: 'integer' }) resourceId: number;
  @PrimaryColumn({ type: 'integer' }) groupId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'boolean', default: false }) read: boolean;
  @Column({ type: 'boolean', default: false }) edit: boolean;
  @Column({ type: 'boolean', default: false }) publish: boolean;
  @Column({ type: 'boolean', default: false }) export: boolean;
}

@Entity('enterprise_group_request')
export class EnterpriseGroupRequest {
  @PrimaryColumn({ type: 'integer' }) actorId: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'integer' }) groupId: number;
}
