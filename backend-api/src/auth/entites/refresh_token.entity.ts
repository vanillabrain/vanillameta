import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class RefreshToken {
    @PrimaryColumn()
    id: number;

    @Column()
    refreshToken: string;
}
