import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn, OneToOne } from "typeorm";
import {Database} from "../../database/entities/database.entity";

@Entity()
export class Dataset {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column()
    databaseId: number

    @Column()
    query: string

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToOne(() => Database, (database) => database.dataset)
    @JoinColumn({'name': 'databaseId'})
    database: Database;

}
