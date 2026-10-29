import { Column, Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

@Entity('private_report')
@Index('IDX_private_report_owner', ['ownerId', 'organizationKey'])
export class PrivateReport {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationKey: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'integer' }) sourceId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 64 }) revision: string;
  @Column({ type: 'varchar', length: 800 }) title: string;
  @Column({ type: 'varchar', length: 32 }) updatedAt: string;
}
@Entity('private_report_revision')
export class PrivateReportRevision {
  @PrimaryColumn({ type: 'varchar', length: 36 }) reportId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'varchar', length: 64 }) revision: string;
  @Column({ type: 'integer' }) bytes: number;
  @Column({ type: 'integer' }) chunkCount: number;
  @ManyToOne(() => PrivateReport, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'reportId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_private_report_revision_head',
  })
  head: PrivateReport;
}
@Entity('private_report_chunk')
export class PrivateReportChunk {
  @PrimaryColumn({ type: 'varchar', length: 36 }) reportId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @PrimaryColumn({ type: 'integer' }) ordinal: number;
  @Column({ type: 'text' }) payload: string;
  @ManyToOne(() => PrivateReportRevision, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'reportId',
      referencedColumnName: 'reportId',
      foreignKeyConstraintName: 'FK_private_report_chunk_revision',
    },
    {
      name: 'version',
      referencedColumnName: 'version',
      foreignKeyConstraintName: 'FK_private_report_chunk_revision',
    },
  ])
  revisionMetadata: PrivateReportRevision;
}
@Entity('private_report_request')
export class PrivateReportRequest {
  @PrimaryColumn({ type: 'integer' }) ownerId: number;
  @PrimaryColumn({ type: 'integer' }) organizationKey: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 36 }) reportId: string;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'integer' }) version: number;
  @ManyToOne(() => PrivateReportRevision, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'reportId',
      referencedColumnName: 'reportId',
      foreignKeyConstraintName: 'FK_private_report_request_revision',
    },
    {
      name: 'version',
      referencedColumnName: 'version',
      foreignKeyConstraintName: 'FK_private_report_request_revision',
    },
  ])
  revisionMetadata: PrivateReportRevision;
}
export const REPORT_ENTITIES = [
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
  PrivateReportRequest,
];
