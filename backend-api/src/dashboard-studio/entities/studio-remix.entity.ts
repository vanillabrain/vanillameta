import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity('studio_remix_request')
@Index('IDX_studio_remix_request_actor', ['actorId', 'requestId'], { unique: true })
export class StudioRemixRequest extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 128 }) requestId: string;
  @Column({ length: 64 }) payloadHash: string;
  @Column({ type: 'text' }) result: string;
}
