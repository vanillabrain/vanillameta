import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Historical metadata consent only; never an ownership transfer or execution ticket. */
@Entity('enterprise_handover_proposal')
export class EnterpriseHandoverProposal {
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) ownerAuthVersion: number;
  @Column({ type: 'integer' }) recipientAuthVersion: number;
  @Column({ type: 'integer' }) organizationVersion: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'integer' }) createdAuditId: number;
  @Column({ type: 'integer', nullable: true }) acceptedAuditId: number | null;
  @Column({ type: 'integer', nullable: true }) cancelledAuditId: number | null;
  @Column({ type: 'varchar', length: 16 }) status: 'pending' | 'accepted' | 'cancelled';
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  acceptedAt: Date | null;
  @Column({ type: 'text' }) manifestJson: string;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'varchar', length: 64 }) reviewBasis: string;
}
