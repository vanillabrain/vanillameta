import { Optional } from '@nestjs/common';
import { YesNo } from 'src/common/enum/yn.enum';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class DashboardShare extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '대시보드 ID' })
  id: number;

  @Column({ comment: '랜덤 유저Id' })
  uuid: string;

  @Column({ nullable: true, length: 300, comment: '공유url 토큰' })
  shareToken: string;

  @Optional()
  @Column({ default: 'N', nullable: false, comment: '공유사용 여브' })
  shareYn: string;

  @Optional()
  @Column({ nullable: true, comment: '유효기한 날짜' })
  endDate: Date;

  /** UC-021: recipients may reuse the saved definition only after the owner opts in. */
  @Optional()
  @Column({ type: 'boolean', default: false, nullable: false, comment: '재사용 허용 여부' })
  allowReuse: boolean;

  /** ABA guard: every grant or share on/off change bumps this opaque version. */
  @Optional()
  @Column({ type: 'integer', default: 0, nullable: false, comment: '재사용 설정 버전' })
  reuseVersion: number;
}
