import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class RefreshToken {
    @PrimaryColumn()
    id: string;

    @Column()
    refreshToken: string;
}
