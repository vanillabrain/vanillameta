import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';

@Entity('event_sessions')
@Index(['userId', 'startTime'])
@Index(['startTime'])
export class EventSession {
  @PrimaryColumn('uuid')
  sessionId: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  lastActivityTime: Date;

  @Column({ type: 'int', default: 0 })
  pageViews: number;

  @Column({ type: 'int', default: 0 })
  eventCount: number;

  // 세션 메타데이터
  @Column({ type: 'varchar', length: 45, nullable: true })
  anonymizedIp?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceType?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  os?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  screenResolution?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  viewportSize?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => AnalyticsEvent, (event) => event.session)
  events: AnalyticsEvent[];
}