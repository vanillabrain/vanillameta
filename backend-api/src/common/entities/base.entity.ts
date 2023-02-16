import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @CreateDateColumn({
    nullable: true,
    comment: '생성일',
  })
  createdAt: Date;

  @UpdateDateColumn({ nullable: true, comment: '수정일' })
  updatedAt: Date;
}
