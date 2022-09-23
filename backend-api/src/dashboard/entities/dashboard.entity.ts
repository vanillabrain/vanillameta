import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Dashboard {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    layout: string

    @Column()
    title: string

    @Column()
    widgets: string

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

}