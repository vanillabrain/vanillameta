import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('document_share')
@Index('UQ_document_share_grantee', ['documentId', 'granteeId'], { unique: true })
@Index('IDX_document_share_grantee', ['granteeId', 'organizationId', 'active'])
export class DocumentShare {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) documentId: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) granteeId: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'varchar', length: 30 }) createdAt: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) revokedAt: string | null;
}
