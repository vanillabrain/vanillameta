import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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

  // 태그 (JSON을 text로 저장)
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
  tags?: Record<string, string>;

  // 메타데이터
  @Column({ type: 'text', nullable: true })
  pageUrl?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceType?: string;

  @CreateDateColumn()
  createdAt: Date;
}
