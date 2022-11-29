import { YesNo } from 'src/common/enum/yn.enum';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class LoginHistory{
    @PrimaryGeneratedColumn({ comment: '로그인 이력번호' })
    loginNo: number; //  순차적인 번호

    @Column({ length: 36, comment: '회원 UID' })
    user_id: string;

    @Column({ length: 20, nullable: true, comment: '로그인 유형' })
    loginType: string; //  PC, 모바일 접속타입

    @Column({ comment: '요청 경로'})
    path: string

    @Column({
        type: 'char',
        nullable: true,
        length: 1,
        comment: '로그인 성공 유무',
    })
    loginSuccYn: YesNo;


    @CreateDateColumn({ type: 'timestamp', nullable: true, comment: '등록 일시' })
    createdAt: Date;
}
