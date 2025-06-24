import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../user/entities/user.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('user_approvals')
export class UserApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ type: 'text', nullable: true })
  applicationNote: string; // 가입 신청 시 메모

  @Column({
    type: process.env.NODE_ENV === 'local' ? 'varchar' : 'enum',
    enum: process.env.NODE_ENV === 'local' ? undefined : ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  reviewNote: string; // 검토 메모

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: User;

  @Column('uuid', { nullable: true })
  reviewedBy: string;

  @Column({ type: process.env.NODE_ENV === 'local' ? 'datetime' : 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}