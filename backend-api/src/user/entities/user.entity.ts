import { IsNotEmpty, IsOptional } from 'class-validator';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity()
export class User extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @IsOptional()
    @Column()
    dashboard_id: number;

    @IsOptional()
    @Column()
    jwt_id: number;

    @IsOptional()
    @Column()
    user_info_id: number;

    @IsOptional()
    @Column()
    url_copy_id: number;
}