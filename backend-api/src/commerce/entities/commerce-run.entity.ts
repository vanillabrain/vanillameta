import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('commerce_run')
export class CommerceRun extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() ownerId: number;
  @Column() sourceId: number;
  @Column({ length: 20 }) status: string;
  @Column({ type: 'text', nullable: true }) resultJson: string;
  @Column({ type: 'text', nullable: true }) errorMessage: string;
  @Column({ length: 64 }) inputDigest: string;
  @Column({ type: 'int' }) expectedVersion: number;
  @Column({ type: 'int', nullable: true }) publishedVersion: number;
}
