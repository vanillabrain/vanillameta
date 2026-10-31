import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
@Entity('enterprise_enrollment')
export class EnterpriseEnrollment {
  @PrimaryColumn({ type: 'integer' }) userId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Index('IDX_enterprise_enrollment_hash', { unique: true })
  @Column({ length: 64 })
  codeHash: string;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
}
