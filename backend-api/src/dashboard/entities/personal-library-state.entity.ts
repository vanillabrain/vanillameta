import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Personal visibility only; never changes dashboard ownership or availability. */
@Entity('personal_library_state')
export class PersonalLibraryState {
  @PrimaryColumn({ type: 'integer' }) userId: number;
  @PrimaryColumn({ type: 'integer' }) organizationId: number;
  @PrimaryColumn({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'boolean', default: false }) archived: boolean;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'datetime' }) updatedAt: Date;
}
