import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Dashboard {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column()
    option: string

    @Column()
    category: string

    @Column()
    type: string

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

}