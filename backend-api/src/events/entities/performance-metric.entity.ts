import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('performance_metrics')
@Index(['name', 'createdAt'])
@Index(['category', 'createdAt'])
@Index(['sessionId'])
export class PerformanceMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  // 태그 (JSON)
  @Column({ type: 'json', nullable: true })
  tags?: Record<string, string>;

  // 메타데이터
  @Column({ type: 'text', nullable: true })
  pageUrl?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceType?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}