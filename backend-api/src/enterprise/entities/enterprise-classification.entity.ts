import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('enterprise_classification')
@Index('UQ_enterprise_classification_name', ['organizationId', 'nameKey'], { unique: true })
export class EnterpriseClassification {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 64 }) nameKey: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer' }) version: number;
}

@Entity('enterprise_classification_request')
export class EnterpriseClassificationRequest {
  @PrimaryColumn({ type: 'integer' }) actorId: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  /** Immutable creation outcome, not current registry state. */
  @Column({ type: 'text' }) result: string;
}
