import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CreateDatabaseDto } from '../dto/create-database.dto';

@Entity()
export class Database extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  details: string;

  @Column()
  engine: string;

  @Column()
  timezone: string;

  static of(name: string, description: string, details: string, engine: string, timezone: string): Database {
    const obj = new Database();
    obj.name = name;
    obj.description = description;
    obj.details = details;
    obj.engine = engine;
    obj.timezone = timezone;
    return obj;
  }

  static toDto(dto: CreateDatabaseDto): Database {
    return Database.of(dto.name, dto.description, dto.details, dto.engine, dto.timezone);
  }

  getFullDescription(): string {
    return `${this.name} ${this.description}`;
  }
}
