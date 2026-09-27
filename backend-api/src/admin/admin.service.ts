import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * 전체 사용자 목록 조회 (비밀번호 제외)
   */
  async findAllUsers() {
    const users = await this.userRepository.find();
    users.forEach(user => delete user.password);
    return { status: ResponseStatus.SUCCESS, data: users };
  }

  /**
   * 사용자 역할 변경
   */
  async updateRole(id: number, role: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('not exist user');
    }
    user.role = role;
    await this.userRepository.save(user);
    delete user.password;
    return { status: ResponseStatus.SUCCESS, data: user };
  }

  /**
   * 감사 로그 조회 (최신순)
   */
  async findAuditLogs(limit = 100) {
    const logs = await this.auditLogRepository.find({
      order: { id: 'DESC' },
      take: limit,
    });
    return { status: ResponseStatus.SUCCESS, data: logs };
  }
}
