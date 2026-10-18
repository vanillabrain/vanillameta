import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Personal presentation state only; never an access grant or deletion of the audit event. */
@Entity('enterprise_notification_state')
export class EnterpriseNotificationState {
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
  @PrimaryColumn({ type: 'integer' }) eventId: number;
  @Column({ type: 'boolean', default: false }) read: boolean;
  @Column({ type: 'boolean', default: false }) removed: boolean;
}
