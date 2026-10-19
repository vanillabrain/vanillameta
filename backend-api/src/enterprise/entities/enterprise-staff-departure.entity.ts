import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('enterprise_staff_departure')
@Index('IDX_staff_departure_user', ['userId', 'status'])
export class EnterpriseStaffDeparture {
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) userId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) authVersion: number;
  @Column({ type: 'integer' }) organizationVersion: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 16 }) status: 'requested' | 'completed' | 'cancelled';
  @Column({ type: 'datetime' }) requestedAt: Date;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) completedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'integer', nullable: true }) completedBy: number | null;
  @Column({ type: 'integer', nullable: true }) completeOrganizationVersion: number | null;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) completePayloadHash: string | null;
  @Column({ type: 'integer' }) requestedAuditId: number;
  @Column({ type: 'integer', nullable: true }) completedAuditId: number | null;
  @Column({ type: 'integer', nullable: true }) cancelledAuditId: number | null;
}
