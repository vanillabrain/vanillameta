import { Injectable } from '@nestjs/common';

export interface AdminNotification {
  type: string;
  data: any;
}

@Injectable()
export class NotificationService {
  /**
   * 관리자들에게 알림 전송
   */
  async notifyAdmins(notification: AdminNotification): Promise<void> {
    console.log('Notifying admins:', notification);
    // TODO: 실제 알림 로직 구현
    // 예: WebSocket, Push Notification, 등
  }
}