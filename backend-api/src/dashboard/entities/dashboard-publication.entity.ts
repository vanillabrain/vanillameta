import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** One published snapshot per dashboard; the row is the only public link source (UC-018). */
@Entity('dashboard_publication')
export class DashboardPublication extends BaseEntity {
  @PrimaryColumn({ type: 'integer', comment: '대시보드 ID' })
  dashboardId: number;

  @Index('UQ_dashboard_publication_uuid', { unique: true })
  @Column({ length: 36, comment: '공개 링크 UUID' })
  uuid: string;

  @Column({ type: 'integer', default: 0, comment: '게시 버전' })
  version: number;

  @Column({ length: 64, comment: '게시 시점의 저장 revision' })
  dashboardRevision: string;

  @Column({ type: 'text', comment: '서버 생성 공개 snapshot' })
  snapshot: string;

  @Column({ length: 40, comment: '게시 시각(ISO)' })
  publishedAt: string;

  @Column({ length: 40, comment: '만료 시각(ISO)' })
  expiresAt: string;

  @Column({ type: 'boolean', default: true, comment: '활성 여부' })
  active: boolean;

  @Column({ length: 36, comment: '마지막 게시 요청Id' })
  requestId: string;

  @Column({ length: 64, comment: '마지막 게시 payload digest' })
  payloadDigest: string;
}
