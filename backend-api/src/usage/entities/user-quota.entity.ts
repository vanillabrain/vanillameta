import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Per-user override of the environment defaults. A missing row, or a null column, uses the default. */
@Entity('user_quota')
export class UserQuota {
  @PrimaryColumn({ type: 'integer' })
  userId: number;

  @Column({ type: 'integer', nullable: true })
  dailyCalls: number | null;

  @Column({ type: 'integer', nullable: true })
  monthlyTokens: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
