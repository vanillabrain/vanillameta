import { IsNotEmpty, IsOptional } from 'class-validator';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BaseEntity} from 'typeorm';


@Entity()
export class UserInfo {

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

    @CreateDateColumn({ default: () => 'CURRENT_TIMESTAMP', type: "timestamp" })
    createdAt: Date;

    @UpdateDateColumn({comment:'수정일'})
    updatedAt: Date;
}