import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

export type ArtifactKind = 'html' | 'pdf' | 'pptx';

@Entity('artifact_file')
@Index('IDX_artifact_file_owner', ['ownerId'])
@Index('UQ_artifact_file_share', ['shareHash'], { unique: true })
export class ArtifactFile {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer', nullable: true }) organizationId: number | null;
  @Column({ type: 'varchar', length: 8 }) kind: ArtifactKind;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'integer' }) headVersion: number;
  @Column({ type: 'integer' }) revision: number;
  @Column({ type: 'varchar', length: 32 }) updatedAt: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) deletedAt: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) shareHash: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) shareExpiresAt: string | null;
}

@Entity('artifact_file_version')
export class ArtifactFileVersion {
  @PrimaryColumn({ type: 'varchar', length: 36 }) artifactId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 255 }) originalName: string;
  @Column({ type: 'varchar', length: 100 }) mimeType: string;
  @Column({ type: 'varchar', length: 8 }) extension: string;
  @Column({ type: 'integer' }) byteSize: number;
  @Column({ type: 'varchar', length: 64 }) sha256: string;
  @Column({ type: 'varchar', length: 100 }) storageKey: string;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
  @ManyToOne(() => ArtifactFile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'artifactId', foreignKeyConstraintName: 'FK_artifact_version_file' })
  artifact: ArtifactFile;
}

export const ARTIFACT_ENTITIES = [ArtifactFile, ArtifactFileVersion];
