import {Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {BaseEntity} from "../../common/entities/base.entity";
import {YesNo} from "../../common/enum/yn.enum";
import {Widget} from "../../widget/entities/widget.entity";

@Entity()
export class Component extends BaseEntity {
    @PrimaryGeneratedColumn({comment: '컴포넌트 ID'})
    id: number

    @Column({unique: true, length: 45, comment: '타입 코드'})
    type: string

    @Column({length: 100, comment: '타입명'})
    title: string

    @Column({length: 300, nullable: true, comment: '설명'})
    description: string

    @Column({length: 45, nullable: true, comment: '분류'})
    category: string

    @Column({type: 'text', comment: '컴포넌트 속성'})
    option: string

    @Column({length: 45, nullable: true, comment: '컴포넌트 아이콘 경로'})
    icon: string

    @Column({comment: '순서', nullable: true})
    seq: number

    @Column({length: 1, comment: '사용여부', default: YesNo.NO})
    useYn: YesNo

    @OneToMany(
        (type => Widget),
        (widget) => widget.componentId
    )
    widgets!: Widget[]

}