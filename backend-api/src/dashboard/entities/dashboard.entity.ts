import { Optional } from '@nestjs/common';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { YesNo } from '../../common/enum/yn.enum';

@Entity()
export class Dashboard extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '대시보드 ID' })
  id: number;

  @Column({ length: 300, comment: '대시보드명' })
  title: string;

  @Optional()
  @Column({ nullable: true, comment: '템플릿 ID' })
  templateId: number;

  @Column({ type: 'text', nullable: true, comment: '레이아웃 정보' })
  layout: string;

  @Optional()
  @Column({ comment: '순서', nullable: true })
  seq: number;

  @Optional()
  @Column({ comment: '공유Id', nullable: true })
  share_id: number;

  @Optional()
  @Column({ length: 1, default: YesNo.NO, comment: '삭제여부' })
  del_yn: YesNo;
}
