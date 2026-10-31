import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('document_summary')
export class DocumentSummary {
  @PrimaryColumn({ type: 'varchar', length: 36 }) documentId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 64 }) sourceSha256: string;
  @Column({ type: 'text' }) summary: string;
  @Column({ type: 'varchar', length: 30 }) generatedAt: string;
}
