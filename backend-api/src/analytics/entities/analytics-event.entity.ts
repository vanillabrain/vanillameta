import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_events')
@Index(['userId', 'createdAt'])
@Index(['category', 'action', 'createdAt'])
@Index(['sessionId', 'createdAt'])
@Index(['correlationId'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  @Column({ type: 'int', nullable: true })
  value?: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  sessionId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  correlationId?: string;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: any) => {
        return value ? JSON.stringify(value) : null;
      },
      from: (value: any) => {
        return value ? JSON.parse(value) : null;
      },
    },
  })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  screenResolution?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  viewport?: string;

  @Column({ type: 'text', nullable: true })
  url?: string;

  @Column({ type: 'text', nullable: true })
  referrer?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  region?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  browser?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  browserVersion?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  os?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  osVersion?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device?: string;

  @CreateDateColumn({ type: process.env.NODE_ENV === 'local' ? 'datetime' : 'timestamp' })
  createdAt: Date;

  @Column({ type: process.env.NODE_ENV === 'local' ? 'datetime' : 'timestamp', nullable: true })
  eventTimestamp?: Date;
}
