import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Historical confirmation; replay never changes the dashboard's current lifecycle state. */
@Entity('dashboard_lifecycle_receipt')
@Index('UQ_dashboard_lifecycle_request', ['actorId', 'requestId'], { unique: true })
@Index('IDX_dashboard_lifecycle_resource', ['dashboardId'])
export class DashboardLifecycleReceipt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) payloadDigest: string;
  @Column({ type: 'boolean' }) active: boolean;
  @Column({ type: 'integer' }) version: number;
  @CreateDateColumn() createdAt: Date;
}
