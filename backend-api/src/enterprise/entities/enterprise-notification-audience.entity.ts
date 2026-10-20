import { Entity, Index, PrimaryColumn } from 'typeorm';
/** Immutable event audience, not a grant or current membership. */
@Entity('enterprise_notification_audience')
@Index('IDX_enterprise_notification_audience_recipient', ['recipientId', 'eventId'])
export class EnterpriseNotificationAudience {
  @PrimaryColumn({ type: 'integer' }) eventId: number;
  @PrimaryColumn({ type: 'integer' }) recipientId: number;
}
