import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One saved state of a dashboard, written in the same transaction as the save. It is what a restore
 * starts from and what answers who changed a dashboard: a person, or an external AI through a named
 * connection. The Studio document carries block and layout definitions; the filters and conditions
 * in it can hold data values, so this table is read by the dashboard's owner only.
 *
 * `seq` orders the rows of a dashboard (a uuid or a timestamp does not, and two saves can share a
 * clock tick). `createdAt` is an ISO string, as in the other artifact tables.
 */
@Entity('dashboard_revision')
@Index('IDX_dashboard_revision_dashboard', ['dashboardId', 'seq'])
export class DashboardRevision {
  @PrimaryGeneratedColumn({ type: 'integer' }) seq: number;
  @Column({ type: 'varchar', length: 36, unique: true }) revisionId: string;
  @Column({ type: 'integer' }) dashboardId: number;
  /** The `dashboardRevision` hash of the saved dashboard; a restore compares against it. */
  @Column({ type: 'varchar', length: 64 }) revision: string;
  /** The same JSON the dashboard's `studio_state.document` held right after the save. */
  @Column({ type: 'text' }) studioDocument: string;
  /**
   * The dashboard row as saved, so a restore can rebuild it. `dashboardRevision` hashes the title,
   * layout, analysisDefinition and structuredDefinition but NOT pivotDefinitions: a change to the
   * pivots does not change the revision, so a restore that wrote them back would silently drop a
   * pivot added since. Treat pivotDefinitions as a record, not as something to restore.
   */
  @Column({ type: 'varchar', length: 300 }) title: string;
  @Column({ type: 'text' }) layout: string;
  @Column({ type: 'text', nullable: true }) analysisDefinition: string | null;
  @Column({ type: 'text', nullable: true }) structuredDefinition: string | null;
  @Column({ type: 'text', nullable: true }) pivotDefinitions: string | null;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer', nullable: true }) organizationId: number | null;
  /** 'create' rows are never pruned; only 'save'/'restore' rows by an external AI are capped. */
  @Column({ type: 'varchar', length: 8 }) operation: 'create' | 'save' | 'restore';
  @Column({ type: 'varchar', length: 12 }) authorKind: 'human' | 'external-ai';
  @Column({ type: 'varchar', length: 36, nullable: true }) aiGrantId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aiClientName: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true }) requestId: string | null;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
}
