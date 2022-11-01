import {Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {BaseEntity} from "../../common/entities/base.entity";
import {YesNo} from "../../common/enum/yn.enum";
import {Dashboard} from "../../dashboard/entities/dashboard.entity";
import {TemplateItem} from "./template-item.entity";

@Entity()
export class Template extends BaseEntity {
    @PrimaryGeneratedColumn({comment: '템플릿 ID'})
    id: number

    @Column({length: 300, nullable: true, comment: '템플릿명'})
    title: string

    @Column({length: 1000, nullable: true, comment: '템플릿 설명'})
    description: string
    //
    // @Column({type: 'text', comment: '레이아웃'})
    // layout: string

    @Column({length: 1, default: YesNo.YES, comment: '사용여부'})
    useYn: YesNo



    @OneToMany(
        (type => TemplateItem),
        (templateItem) => templateItem.templateId
    )
    templateItems!: TemplateItem[]

}
