import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('ai_artifact_share')
@Index('IDX_ai_artifact_share_recipient', ['recipientId'])
export class AiArtifactShare {
  @PrimaryColumn({ type: 'varchar', length: 36 }) artifactId: string;
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) ownerEpoch: number;
  @Column({ type: 'integer' }) recipientEpoch: number;
}
