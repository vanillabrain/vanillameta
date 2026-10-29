import { Column, Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PrivateReportRevision, PrivateReport } from './report.entity';

@Entity('private_report_delivery')
@Index('IDX_report_delivery_recipient', ['recipientId', 'active'])
export class ReportDelivery {
  @PrimaryColumn({ type: 'varchar', length: 36 }) reportId: string;
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'boolean' }) active: boolean;
  @Column({ type: 'integer' }) relationVersion: number;
  @Column({ type: 'integer' }) pinnedVersion: number;
  @Column({ type: 'varchar', length: 64 }) pinnedHash: string;
  @Column({ type: 'integer' }) ownerAuthVersion: number;
  @Column({ type: 'integer' }) recipientAuthVersion: number;
  @ManyToOne(() => PrivateReportRevision, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'reportId',
      referencedColumnName: 'reportId',
      foreignKeyConstraintName: 'FK_report_delivery_revision',
    },
    {
      name: 'pinnedVersion',
      referencedColumnName: 'version',
      foreignKeyConstraintName: 'FK_report_delivery_revision',
    },
  ])
  pinned: PrivateReportRevision;
}

@Entity('private_report_delivery_receipt')
export class ReportDeliveryReceipt {
  @PrimaryColumn({ type: 'integer' }) ownerId: number;
  @PrimaryColumn({ type: 'integer' }) organizationId: number;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 36 }) reportId: string;
  @Column({ type: 'varchar', length: 64 }) payloadHash: string;
  @Column({ type: 'text' }) result: string;
  @ManyToOne(() => PrivateReport, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'reportId', foreignKeyConstraintName: 'FK_report_delivery_receipt_head' })
  head: PrivateReport;
}
export const REPORT_SHARING_ENTITIES = [ReportDelivery, ReportDeliveryReceipt];
