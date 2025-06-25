import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AuditLogCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  USER_MANAGEMENT = 'user_management',
  ROLE_MANAGEMENT = 'role_management',
  DATA_ACCESS = 'data_access',
  SYSTEM_CONFIG = 'system_config',
  GENERAL = 'general',
}

@Entity('audit_logs')
@Index(['action', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['ipAddress', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // LOGIN_SUCCESS, USER_CREATED, ROLE_ASSIGNED, etc.

  @Column({ nullable: true })
  resourceType: string; // User, Role, Report, DataSource, etc.

  @Column({ nullable: true })
  resourceId: string;

  @Column('uuid', { nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userName: string; // 사용자 삭제 시에도 기록 유지

  @Column({ nullable: true })
  userEmail: string;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>; // 추가 상세 정보

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, any>; // 변경 전 값

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any>; // 변경 후 값

  @Column({
    type: 'enum',
    enum: AuditLogLevel,
    default: AuditLogLevel.INFO,
  })
  level: AuditLogLevel;

  @Column({
    type: 'enum',
    enum: AuditLogCategory,
    default: AuditLogCategory.GENERAL,
  })
  category: AuditLogCategory;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean; // 시스템 자동 생성 로그 여부

  @Column({ type: 'boolean', default: false })
  isSensitive: boolean; // 민감한 정보 포함 여부

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}