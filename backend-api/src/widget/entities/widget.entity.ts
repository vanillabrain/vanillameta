import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class Widget {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    datasetId: number

    @Column()
    componentId: number

    @Column()
    title: string

    @Column()
    option: string

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

}
