import { IsNotEmpty, IsOptional } from 'class-validator';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BaseEntity} from 'typeorm';


@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number;

    @IsNotEmpty()
    @Column()
    userId: string;

    @Column()
    jwtId: string;

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