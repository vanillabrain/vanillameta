import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Past confirmation only; replay never recreates or deletes another dashboard. */
@Entity('dashboard_delete_receipt')
@Index('UQ_dashboard_delete_request', ['actorId', 'requestId'], { unique: true })
@Index('IDX_dashboard_delete_resource', ['dashboardId'])
export class DashboardDeleteReceipt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer', nullable: true }) organizationId: number | null;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) expectedRevision: string;
  @Column({ type: 'varchar', length: 64 }) digest: string;
  @CreateDateColumn() createdAt: Date;
}
