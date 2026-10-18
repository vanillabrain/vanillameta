import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bi_organization')
@Index('UQ_bi_org_owner_name', ['ownerId', 'name'], { unique: true })
export class BiOrganization {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ length: 100 }) name: string;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
@Entity('bi_organization_group')
@Index('UQ_bi_org_group_name', ['organizationId', 'name'], { unique: true })
export class BiOrganizationGroup {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ length: 100 }) name: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
}
@Entity('bi_organization_member')
@Index('UQ_bi_org_member', ['organizationId', 'actorId'], { unique: true })
export class BiOrganizationMember {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer', nullable: true }) groupId: number | null;
  @Column({ length: 12 }) role: 'admin' | 'viewer';
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
}
@Entity('bi_dashboard_policy')
@Index('UQ_bi_dashboard_policy_group', ['organizationId', 'dashboardId', 'groupId'], {
  unique: true,
})
export class BiDashboardPolicy {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) groupId: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ length: 100 }) displayTitle: string;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'boolean', default: false }) allowAi: boolean;
  @Column({ type: 'boolean', default: false }) allowExport: boolean;
  @Column({ length: 64 }) dashboardRevision: string;
  @Column({ length: 64 }) sourceRevision: string;
  /** Encrypted private recipe; member APIs project a separately validated response. */
  @Column({ type: 'text' }) recipe: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) expiresAt: string | null;
  @CreateDateColumn() createdAt: Date;
}
@Entity('bi_policy_audit')
@Index('IDX_bi_policy_audit_org', ['organizationId', 'id'])
export class BiPolicyAudit {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer', nullable: true }) policyId: number | null;
  @Column({ type: 'integer', nullable: true }) policyVersion: number | null;
  @Column({ length: 24 }) action: string;
  @Column({ length: 12 }) outcome: 'allowed' | 'denied' | 'failed';
  @CreateDateColumn() createdAt: Date;
}
