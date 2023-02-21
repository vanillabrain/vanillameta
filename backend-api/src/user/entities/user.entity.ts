import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 Id' })
  @ApiProperty({ description: '유저Id' })
  userId: string;

  @Column({nullable: true})
  @ApiProperty({ description: 'refreshTokenId' })
  jwtId: number;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 email' })
  @ApiProperty({ description: '유저 email' })
  email: string;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 password' })
  @ApiProperty({ description: '유저 password' })
  password: string;

  @CreateDateColumn({ default: () => 'CURRENT_TIMESTAMP', comment: '생성일' })
  createdAt: Date;
  @UpdateDateColumn({ default: () => 'CURRENT_TIMESTAMP', comment: '수정일' })
  updatedAt: Date;
}
