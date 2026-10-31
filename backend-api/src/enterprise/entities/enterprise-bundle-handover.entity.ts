import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Final consent and historical receipt; one irreversible completion per intent. */
@Entity('enterprise_bundle_handover')
@Index('UQ_bundle_handover_request', ['requestId'], { unique: true })
export class EnterpriseBundleHandover {
  @PrimaryColumn({ type: 'varchar', length: 36 }) proposalId: string;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) ownerAuthVersion: number;
  @Column({ type: 'integer' }) recipientAuthVersion: number;
  @Column({ type: 'integer' }) organizationVersion: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 16 }) status:
    | 'prepared'
    | 'accepted'
    | 'completed'
    | 'cancelled';
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
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  completedAt: Date | null;
  @Column({ type: 'integer' }) preparedAuditId: number;
  @Column({ type: 'integer', nullable: true }) acceptedAuditId: number | null;
  @Column({ type: 'integer', nullable: true }) completedAuditId: number | null;
  @Column({ type: 'integer', nullable: true }) cancelledAuditId: number | null;
  @Column({ type: 'text' }) manifestJson: string;
  @Column({ type: 'varchar', length: 64 }) basisHash: string;
  @Column({ type: 'varchar', length: 64 }) custodyHash: string;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'varchar', length: 64 }) reviewBasis: string;
}
