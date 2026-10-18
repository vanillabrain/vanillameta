import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Employee consent; never a grant. Completed rows are historical, not current access. */
@Entity('enterprise_staff_transfer')
export class EnterpriseStaffTransfer {
  @PrimaryColumn({ type: 'integer' }) userId: number;
  @Column({ type: 'integer' }) sourceOrganizationId: number;
  @Column({ type: 'integer' }) targetOrganizationId: number;
  @Column({ type: 'integer' }) authVersion: number;
  @Index('UQ_enterprise_staff_transfer_code', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  codeHash: string;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'integer', nullable: true }) acceptedBy: number | null;
  @Column({ type: 'integer', nullable: true }) acceptedEpoch: number | null;
  @Column({ type: 'integer', nullable: true }) targetVersion: number | null;
  @Column({ type: 'varchar', length: 100, default: '' }) team: string;
  @Column({ type: 'boolean', default: false }) completed: boolean;
}
