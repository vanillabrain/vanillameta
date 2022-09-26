import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class Template {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    layout: string

    @Column()
    title: string

    @Column()
    description: string

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

}
