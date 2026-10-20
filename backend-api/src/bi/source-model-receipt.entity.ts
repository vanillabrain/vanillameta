import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
@Entity('source_model_receipt')
@Unique('UQ_source_model_actor_request', ['actorId', 'requestId'])
export class SourceModelReceipt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) payloadDigest: string;
  @Column({ type: 'integer', nullable: true }) sourceId: number | null;
  @CreateDateColumn() createdAt: Date;
}
