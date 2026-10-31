import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ReportDelivery } from './report-sharing.entity';

export async function revokeReportDeliveriesForTransfer(
  manager: EntityManager,
  userId: ReportDelivery['ownerId'],
): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Report delivery transfer requires an active transaction');

  const invalid = manager
    .createQueryBuilder(ReportDelivery, 'delivery')
    .where('(delivery.ownerId = :userId OR delivery.recipientId = :userId)', { userId })
    .andWhere('delivery.active = :active', { active: true })
    .andWhere('(delivery.relationVersion < 1 OR delivery.relationVersion >= :max)', {
      max: 2147483647,
    })
    .take(1);
  // A locking read sees shares committed while transfer waited for the User lock.
  if (manager.connection.options.type !== 'sqlite') invalid.setLock('pessimistic_write');
  if (await invalid.getOne())
    throw new ConflictException('리포트 공유 관계 버전 한도를 확인해 주세요.');

  await manager
    .createQueryBuilder()
    .update(ReportDelivery)
    .set({ active: false, relationVersion: () => 'relationVersion + 1' })
    .where('(ownerId = :userId OR recipientId = :userId)', { userId })
    .andWhere('active = :active', { active: true })
    .execute();
}
