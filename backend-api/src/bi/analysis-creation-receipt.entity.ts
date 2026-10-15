import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
@Entity()
@Unique('UQ_analysis_creation_request', ['actorId', 'requestId'])
export class AnalysisCreationReceipt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) payloadDigest: string;
  @Column({ type: 'integer', nullable: true }) dashboardId: number | null;
  @CreateDateColumn() createdAt: Date;
}
