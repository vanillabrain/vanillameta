import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('Sample')
export class Sample {
    @PrimaryColumn()
    id: number;

    @Column({ length: 300 })
    title: string;

    @Column({ length: 20 })
    description: string;

    @Column('timestamp')
    createdAt: Date;

    @Column('timestamp')
    updatedAt: Date;


}
