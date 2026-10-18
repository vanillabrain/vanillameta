import { Column, Entity, PrimaryColumn, Index } from 'typeorm';
@Entity('enterprise_membership')
export class EnterpriseMembership {
  @PrimaryColumn({ type: 'integer' }) userId: number;
  @Index('IDX_enterprise_membership_org') @Column({ type: 'integer' }) organizationId: number;
  @Column({ length: 16 }) role: 'admin' | 'member';
  @Column({ length: 100, default: '' }) team: string;
}
