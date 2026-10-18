import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** UC050: append-only business metadata; raw rows and connection details never belong here. */
@Entity('source_catalog_entry')
export class SourceCatalogEntry {
  @PrimaryColumn({ type: 'integer' }) sourceId: number;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 64 }) schemaRevision: string;
  @Column({ length: 128 }) sourceRevision: string;
  @Column({ type: 'text' }) metadata: string;
  @CreateDateColumn() createdAt: Date;
}
