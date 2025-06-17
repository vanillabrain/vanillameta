import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EventSession } from './event-session.entity';

@Entity('analytics_events')
@Index(['userId', 'createdAt'])
@Index(['action', 'category'])
@Index(['sessionId'])
@Index(['createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value?: number;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'uuid' })
  correlationId: string;

  // 이벤트 속성 (JSON)
  @Column({ type: 'json', nullable: true })
  properties?: Record<string, any>;

  // 사용자 속성 (JSON)
  @Column({ type: 'json', nullable: true })
  userProperties?: Record<string, any>;

  // 익명화된 IP (마지막 옥텟 제거)
  @Column({ type: 'varchar', length: 45, nullable: true })
  anonymizedIp?: string;

  // 사용자 에이전트
  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  // 페이지 URL
  @Column({ type: 'text', nullable: true })
  pageUrl?: string;

  // 리퍼러
  @Column({ type: 'text', nullable: true })
  referrer?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => EventSession, (session) => session.events)
  @JoinColumn({ name: 'sessionId' })
  session: EventSession;
}