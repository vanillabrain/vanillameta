import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class DashboardWidget {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    dashboardId: number;

    @Column()
    widgetId: string;
}
