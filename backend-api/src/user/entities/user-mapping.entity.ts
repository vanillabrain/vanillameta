import { ApiProperty } from '@nestjs/swagger';
import {  IsOptional } from 'class-validator';
import { Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity()
export class UserMapping extends BaseEntity {

    @PrimaryGeneratedColumn()
    @ApiProperty({ description: 'id'})
    id: number;

    @IsOptional()
    @Column()
    @ApiProperty({ description: '대시보드id'})
    dashboardId: number;

    @Column()
    @ApiProperty({ description: '유저id'})
    userInfoId: number;

    // @IsOptional()
    // @Column()
    // url_copy_id: number;
}