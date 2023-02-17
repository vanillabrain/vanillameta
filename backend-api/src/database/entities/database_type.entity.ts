import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { YesNo } from '../../common/enum/yn.enum';

@Entity('databaseType')
export class DatabaseType extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: 'database type ID' })
  id: number;

  @Column({ length: 45, comment: '타입 코드' })
  type: string;

  @Column({ length: 20, comment: '연결 엔진', nullable: true })
  engine: string;

  @Column({ length: 100, comment: '타입명' })
  title: string;

  @Column({ comment: '순서', nullable: true })
  seq: number;

  @Column({ length: 1, comment: '사용여부', default: YesNo.YES })
  useYn: string;
}
