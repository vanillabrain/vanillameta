import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity()
@Index('IDX_USER_MAPPING_USER_INFO_ID', ['userInfoId'])
@Index('IDX_USER_MAPPING_DASHBOARD_ID', ['dashboardId'])
export class UserMapping extends BaseEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @IsOptional()
  @Column()
  @ApiProperty({ description: '대시보드id' })
  dashboardId: number;

  @Column()
  @ApiProperty({ description: '유저id' })
  userInfoId: number;

  // @IsOptional()
  // @Column()
  // url_copy_id: number;
}
