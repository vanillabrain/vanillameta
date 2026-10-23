import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Which account signed up with which invitation. */
@Entity('invite_redemption')
@Index('UQ_invite_redemption_pair', ['inviteCodeId', 'userId'], { unique: true })
export class InviteRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  inviteCodeId: number;

  @Column({ type: 'integer' })
  userId: number;

  @CreateDateColumn()
  redeemedAt: Date;
}
