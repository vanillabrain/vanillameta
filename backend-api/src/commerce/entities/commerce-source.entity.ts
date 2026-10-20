import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('commerce_source')
export class CommerceSource extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() ownerId: number;
  @Column({ length: 160 }) name: string;
  @Column({ type: 'text', nullable: true }) publishedFilename: string;
  @Column({ type: 'text', nullable: true }) summaryJson: string;
  @Column({ type: 'text', nullable: true }) presentationJson: string;
  @Column({ type: 'text', nullable: true }) publishedDigest: string;
  @Column({ type: 'int', default: 0 }) currentVersion: number;
  @Column({ length: 20, default: 'empty' }) status: string;
}
