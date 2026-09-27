import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class AdminService {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

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
}
