import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';
@Entity('enterprise_audit_event')
export class EnterpriseAuditEvent {
  @PrimaryGeneratedColumn() id: number;
  @Index('IDX_enterprise_audit_org') @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 40 }) action: string;
  @Column({ type: 'integer' }) resourceId: number;
  @Column({ type: 'integer', nullable: true }) subjectId: number | null;
  @Column({ type: 'integer' }) version: number;
  @CreateDateColumn() createdAt: Date;
}
