import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 감사 로그 (append-only).
 * 쓰기 요청(POST/PUT/PATCH/DELETE)을 기록하며, 수정/삭제 API 는 제공하지 않는다.
 */
@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn({ comment: '감사 로그 ID' })
  id: number;

  @Column({ nullable: true, comment: '행위자 User.id' })
  actorId: number;

  @Column({ length: 255, nullable: true, comment: '행위자 userId' })
  actorUserId: string;

  @Column({ length: 10, comment: 'HTTP 메서드' })
  method: string;

  @Column({ length: 500, comment: '요청 경로' })
  path: string;

  @Column({ length: 200, nullable: true, comment: '액션 요약' })
  action: string;

  @Column({ nullable: true, comment: '응답 상태 코드' })
  statusCode: number;

  @Column({ length: 45, nullable: true, comment: '요청 IP' })
  ip: string;

  @Column({ length: 64, nullable: true, comment: '상관관계 ID' })
  requestId: string;

  @CreateDateColumn({ comment: '생성일' })
  createdAt: Date;
}
