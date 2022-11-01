import {Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {BaseEntity} from "../../common/entities/base.entity";
import {YesNo} from "../../common/enum/yn.enum";
import {Dashboard} from "../../dashboard/entities/dashboard.entity";
import {Template} from "./template.entity";

@Entity()
export class TemplateItem extends BaseEntity {
    @PrimaryGeneratedColumn({comment: '템플릿 아이템 ID'})
    id: number

    @Column({comment: '템플릿 ID'})
    templateId: number

    @Column({comment: 'x좌표 값'})
    x: number

    @Column({comment: 'y좌표 값'})
    y: number

    @Column({comment: '너비'})
    width: number

    @Column({comment: '높이'})
    height: number

    @Column({length: 45, nullable: true, comment: '컴포넌트 분류'})
    recommendCategory: string

    @Column({length: 45, nullable: true, comment: '컴포넌트 타입 코드'})
    recommendType: string

    @ManyToOne(
        (type => Template),
        (template) => template.id
    )
    template!: Template[]

}
