import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Comments, replies and suggested edits on artifacts (artifactKind 'report' or 'dashboard').
 * No FK to private_report* or dashboard: dashboard deletion and handover remove their rows
 * (deleteDashboardComments); reports have no delete path yet, adding one must handle these rows.
 * Must stay identical to migrations/postgres/1793560000000-add-artifact-comments.ts plus
 * 1793580000000-add-dashboard-comment-anchor.ts.
 */
@Entity('artifact_comment_thread')
@Index('IDX_artifact_comment_thread_artifact', ['artifactKind', 'artifactId', 'version'])
export class ArtifactCommentThread {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 16 }) artifactKind: string;
  @Column({ type: 'varchar', length: 36 }) artifactId: string;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 8 }) anchorKind: string;
  @Column({ type: 'integer', nullable: true }) anchorStart: number | null;
  @Column({ type: 'integer', nullable: true }) anchorEnd: number | null;
  @Column({ type: 'text', nullable: true }) anchorQuote: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) anchorPrefix: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) anchorSuffix: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) anchorBlockId: string | null;
  @Column({ type: 'varchar', length: 16 }) status: string;
  @Column({ type: 'integer' }) statusVersion: number;
  @Column({ type: 'integer' }) createdBy: number;
  @Column({ type: 'varchar', length: 8 }) authorKind: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) aiGrantId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aiClientName: string | null;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
  @Column({ type: 'integer', nullable: true }) resolvedBy: number | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) resolvedAt: string | null;
  /** Dashboard threads: the dashboardRevision the author saw, and the chart title/type snapshot. */
  @Column({ type: 'varchar', length: 64, nullable: true }) artifactRevision: string | null;
  @Column({ type: 'text', nullable: true }) anchorLabel: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) anchorType: string | null;
}

@Entity('artifact_comment')
@Index('IDX_artifact_comment_threadId', ['threadId'])
export class ArtifactComment {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) threadId: string;
  @Column({ type: 'integer' }) authorId: number;
  @Column({ type: 'varchar', length: 8 }) authorKind: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) aiGrantId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aiClientName: string | null;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
  @ManyToOne(() => ArtifactCommentThread, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'threadId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_artifact_comment_thread',
  })
  thread: ArtifactCommentThread;
}

@Entity('artifact_suggestion')
@Index('IDX_artifact_suggestion_artifact', ['artifactId', 'status'])
export class ArtifactSuggestion {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) threadId: string;
  @Column({ type: 'varchar', length: 36 }) artifactId: string;
  @Column({ type: 'integer' }) baseVersion: number;
  @Column({ type: 'integer' }) anchorStart: number;
  @Column({ type: 'integer' }) anchorEnd: number;
  @Column({ type: 'text' }) anchorQuote: string;
  @Column({ type: 'varchar', length: 32 }) anchorPrefix: string;
  @Column({ type: 'varchar', length: 32 }) anchorSuffix: string;
  @Column({ type: 'text' }) replacement: string;
  @Column({ type: 'text', nullable: true }) rationale: string | null;
  @Column({ type: 'varchar', length: 16 }) status: string;
  @Column({ type: 'integer' }) statusVersion: number;
  @Column({ type: 'integer' }) createdBy: number;
  @Column({ type: 'varchar', length: 8 }) authorKind: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) aiGrantId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aiClientName: string | null;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
  @Column({ type: 'integer', nullable: true }) decidedBy: number | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) decidedAt: string | null;
  @Column({ type: 'integer', nullable: true }) appliedVersion: number | null;
  @ManyToOne(() => ArtifactCommentThread, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'threadId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_artifact_suggestion_thread',
  })
  thread: ArtifactCommentThread;
}

/** Write idempotency: same (actor, organization, requestId) and payload replays the result. */
@Entity('artifact_comment_receipt')
export class ArtifactCommentReceipt {
  @PrimaryColumn({ type: 'integer' }) actorId: number;
  @PrimaryColumn({ type: 'integer' }) organizationKey: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 32 }) operation: string;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'varchar', length: 36 }) resultId: string;
  @Column({ type: 'varchar', length: 32 }) createdAt: string;
}

export const REPORT_COMMENT_ENTITIES = [
  ArtifactCommentThread,
  ArtifactComment,
  ArtifactSuggestion,
  ArtifactCommentReceipt,
];
