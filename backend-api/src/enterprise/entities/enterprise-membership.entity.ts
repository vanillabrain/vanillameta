import { Column, Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('enterprise_membership')
export class EnterpriseMembership {
  @PrimaryColumn({ type: 'integer' }) userId: number;
  @Index('IDX_enterprise_membership_org') @Column({ type: 'integer' }) organizationId: number;
  @Column({ length: 16 }) role: 'admin' | 'member';
  @Column({ length: 100, default: '' }) team: string;

  /**
   * UC-051 logical owner reference. The userId column stays the primary key so existing
   * readers keep working; the relation only adds the RESTRICT foreign key as a last
   * defence and is never eager-loaded into responses.
   */
  @ManyToOne(() => User, { onDelete: 'RESTRICT', eager: false, nullable: false })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_enterprise_membership_user' })
  user: User;
}
