import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class RefreshToken {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    refreshToken: string;
}
