import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type AiArtifactKind = 'html' | 'document' | 'sheet' | 'chart';

@Entity('ai_artifact')
@Index('IDX_ai_artifact_owner', ['ownerId', 'updatedAt'])
export class AiArtifact {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer', nullable: true }) organizationId: number | null;
  @Column({ type: 'varchar', length: 16 }) kind: AiArtifactKind;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'simple-json' }) content: Record<string, unknown>;
  @Column({ type: 'integer' }) revision: number;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
  @Column({ type: 'varchar', length: 32 }) updatedAt: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) deletedAt: string | null;
}
