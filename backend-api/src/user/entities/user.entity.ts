import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from '../../modules/admin/entities/role.entity';

export enum UserStatus {
  ACTIVE = 'active',        // 활성
  INACTIVE = 'inactive',    // 비활성
  PENDING = 'pending',      // 승인 대기
  SUSPENDED = 'suspended',  // 정지
  DELETED = 'deleted'       // 삭제됨
}

@Entity()
@Index('IDX_USER_USER_ID', entity => [entity.userId], { unique: true })
@Index('IDX_USER_EMAIL', entity => [entity.email], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'id' })
  id: number;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 Id' })
  @ApiProperty({ description: '유저Id' })
  userId: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'refreshTokenId' })
  jwtId: number;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 email' })
  @ApiProperty({ description: '유저 email' })
  email: string;

  @IsNotEmpty()
  @Column({ length: 255, comment: '유저 password', select: false })
  @ApiProperty({ description: '유저 password' })
  password: string;

  @Column({ length: 255, comment: '사용자 이름', nullable: true })
  @ApiProperty({ description: '사용자 이름' })
  name: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
    comment: '사용자 상태'
  })
  @ApiProperty({ description: '사용자 상태', enum: UserStatus })
  status: UserStatus;

  @Column({ nullable: true, comment: '프로필 이미지 URL' })
  @ApiProperty({ description: '프로필 이미지 URL' })
  avatar: string;

  @Column({ nullable: true, comment: '전화번호' })
  @ApiProperty({ description: '전화번호' })
  phone: string;

  @Column({ nullable: true, comment: '부서' })
  @ApiProperty({ description: '부서' })
  department: string;

  @Column({ type: 'timestamp', nullable: true, comment: '마지막 로그인 시간' })
  @ApiProperty({ description: '마지막 로그인 시간' })
  lastLoginAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '이메일 인증 시간' })
  @ApiProperty({ description: '이메일 인증 시간' })
  emailVerifiedAt: Date;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: Role[];

  @CreateDateColumn({ default: () => 'CURRENT_TIMESTAMP', comment: '생성일' })
  createdAt: Date;
  @UpdateDateColumn({ default: () => 'CURRENT_TIMESTAMP', comment: '수정일' })
  updatedAt: Date;
  
  @DeleteDateColumn({ comment: '삭제일' })
  deletedAt: Date;
}
