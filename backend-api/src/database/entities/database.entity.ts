import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Database {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    name: string

    @Column()
    description: string

    @Column()
    details: string

    @Column()
    engine: string

    @Column()
    timezone: string

    @Column({
        name: 'created_at',
        type: 'timestamp with time zone',
    })
    createdAt: Date;

    @Column({
        name: 'updated_at',
        type: 'timestamp with time zone',
    })
    updatedAt: Date;

    static from(
        name: string,
        description: string,
        details: string,
        engine: string,
        timezone: string,
    ) {
        const obj = new Database();
        obj.name = name;
        obj.description = description;
        obj.details = details;
        obj.engine = engine;
        obj.timezone = timezone;
        obj.createdAt = new Date();
        obj.updatedAt = new Date();
        return obj;
    }
}
