import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type WaitlistStatus = 'pending' | 'approved' | 'rejected';

@Entity('waitlist_entry')
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_waitlist_entry_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: WaitlistStatus;

  /** The invitation issued when the entry was approved. */
  @Column({ type: 'integer', nullable: true })
  inviteCodeId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  decidedAt: Date | null;
}
