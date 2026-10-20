import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index('IDX_USER_USER_ID', entity => [entity.userId], { unique: true })
@Index('IDX_USER_EMAIL', entity => [entity.email], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  authVersion: number;

  @IsNotEmpty()
  @Index('UQ_user_userId', { unique: true })
  @Column({ length: 255, comment: '유저 Id' })
  @ApiProperty({ description: '유저Id' })
  userId: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'refreshTokenId' })
  jwtId: number;

  @IsNotEmpty()
  @Index('UQ_user_email', { unique: true })
  @Column({ length: 255, comment: '유저 email' })
  @ApiProperty({ description: '유저 email' })
  email: string;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 password' })
  @ApiProperty({ description: '유저 password' })
  password: string;

  @CreateDateColumn({ comment: '생성일' })
  createdAt: Date;
  @UpdateDateColumn({ comment: '수정일' })
  updatedAt: Date;
}
