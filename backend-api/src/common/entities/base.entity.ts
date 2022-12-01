import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @CreateDateColumn({comment:'생성일', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', nullable: true})
  createdAt: Date;

  @UpdateDateColumn({comment:'수정일'})
  updatedAt: Date;
}
