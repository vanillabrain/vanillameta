import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../user/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column('uuid')
  roleId: string;

  @ManyToOne(() => User, (user) => user.userRoles)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Role, (role) => role.userRoles)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // 임시 역할 만료일

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedBy' })
  assignedBy: User;

  @Column({ nullable: true })
  assignedById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}