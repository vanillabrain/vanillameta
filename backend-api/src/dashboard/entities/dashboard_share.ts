import { Optional } from '@nestjs/common';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class DashboardShare extends BaseEntity {
    @PrimaryGeneratedColumn({ comment: '대시보드 ID' })
    id: number;

    @Column({ length: 300, comment: '대시보드명' })
    share_token: string;

    @Optional()
    @Column({ nullable: true, comment: '템플릿 ID' })
    share_yn: string;
}
