import { Injectable } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class EmailService {
  /**
   * 가입 신청 대기 안내 이메일 발송
   */
  async sendRegistrationPendingEmail(user: User): Promise<void> {
    console.log(`Sending registration pending email to ${user.email}`);
    // TODO: 실제 이메일 발송 로직 구현
    // 현재는 로그만 출력
  }

  /**
   * 승인 완료 이메일 발송
   */
  async sendApprovalSuccessEmail(user: User, welcomeMessage?: string): Promise<void> {
    console.log(`Sending approval success email to ${user.email}`);
    console.log(`Welcome message: ${welcomeMessage || '환영합니다!'}`);
    // TODO: 실제 이메일 발송 로직 구현
  }

  /**
   * 승인 거부 이메일 발송
   */
  async sendApprovalRejectionEmail(user: User, reason: string): Promise<void> {
    console.log(`Sending approval rejection email to ${user.email}`);
    console.log(`Rejection reason: ${reason}`);
    // TODO: 실제 이메일 발송 로직 구현
  }
}