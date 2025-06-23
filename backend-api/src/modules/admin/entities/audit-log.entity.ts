import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['action'])
@Index(['userId'])
@Index(['createdAt'])
@Index(['entityType'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50, nullable: true })
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ length: 100, nullable: true })
  userEmail: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({ 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value: Record<string, any>) => value ? JSON.stringify(value) : null,
      from: (value: string) => value ? JSON.parse(value) : {}
    }
  })
  metadata: Record<string, any>;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Column({ length: 500, nullable: true })
  userAgent: string;

  @Column({ default: 'success' })
  status: string; // success, error, warning

  @CreateDateColumn()
  createdAt: Date;
}