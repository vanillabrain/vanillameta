import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('ai_artifact_revision')
export class AiArtifactRevision {
  @PrimaryColumn({ type: 'varchar', length: 36 }) artifactId: string;
  @PrimaryColumn({ type: 'integer' }) revision: number;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'simple-json' }) content: Record<string, unknown>;
  @Column({ type: 'varchar', length: 32 }) updatedAt: string;
}
