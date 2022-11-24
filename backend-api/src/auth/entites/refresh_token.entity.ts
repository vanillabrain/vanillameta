import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class RefreshToken {
    @PrimaryColumn()
    id: string;

    @Column()
    user_id: string;

    @Column()
    refreshToken: string;
}
