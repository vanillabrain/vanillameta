import { IsNotEmpty, IsOptional } from 'class-validator';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity()
export class User  extends BaseEntity{

    @PrimaryGeneratedColumn()
    id: number;

    @IsNotEmpty()
    @Column()
    user_id: string;

    @IsNotEmpty()
    @Column()
    email: string;

    @IsNotEmpty()
    @Column()
    password: string;
}