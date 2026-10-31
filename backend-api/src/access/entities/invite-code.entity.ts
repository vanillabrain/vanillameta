import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** An invitation to sign up. Only the hash is stored; the code itself is shown once when it is made. */
@Entity('invite_code')
export class InviteCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_invite_code_hash', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  codeHash: string;

  /** Free text for the operator, e.g. who the code was given to. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @Column({ type: 'integer', default: 1 })
  maxUses: number;

  @Column({ type: 'integer', default: 0 })
  usedCount: number;

  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
