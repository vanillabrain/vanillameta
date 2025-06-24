import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // admin.users.create, dashboard.view, etc.

  @Column()
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  module: string; // admin, dashboard, analytics, etc.

  @Column()
  action: string; // create, read, update, delete, manage

  @Column()
  resource: string; // users, roles, reports, etc.

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}