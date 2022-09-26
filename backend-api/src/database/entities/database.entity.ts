import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn, OneToOne } from "typeorm";
import {Dataset} from "../../dataset/entities/dataset.entity";

@Entity()
export class Database {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  title: string

  @Column()
  type: string

  @Column()
  host: string

  @Column()
  port: string

  @Column()
  userId: string

  @Column()
  userPassword: string

  @Column()
  schema: string

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Dataset, (dataset) => dataset.database)
  @JoinColumn({'name': 'databaseId'})
  dataset: Dataset;

}
