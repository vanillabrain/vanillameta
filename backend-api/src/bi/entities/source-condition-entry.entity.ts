import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
/** UC052: versioned private predicates; no source rows, SQL or connection credentials. */
@Entity('source_condition_entry')
export class SourceConditionEntry {
  @PrimaryColumn({ type: 'integer' }) sourceId: number;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 128 }) sourceRevision: string;
  @Column({ type: 'text' }) definition: string;
  @Column({ type: 'text', nullable: true }) semanticsJSON: string | null;
  @CreateDateColumn() createdAt: Date;
}
