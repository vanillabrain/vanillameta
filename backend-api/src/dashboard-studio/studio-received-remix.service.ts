import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { StudioService } from './studio.service';

const REFERENCE = /^d-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([a-f0-9]{64})$/;
@Injectable()
export class StudioReceivedRemixService {
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly access: SourceAccessService,
  ) {}
  private async context(id: number, actor: number, manager: EntityManager) {
    await this.access.dashboard(id, actor, 'read', manager);
    const member = await manager.findOneBy(EnterpriseMembership, { userId: actor });
    const owners = await manager.find(UserMapping, { where: { dashboardId: id }, take: 2 });
    if (!member || owners.length !== 1)
      throw new ForbiddenException('현재 받은 자료의 복제 허용이 필요합니다.');
    const row = await manager.findOneBy(EnterpriseDashboardDelivery, {
      ownerId: owners[0].userInfoId,
      organizationId: member.organizationId,
      dashboardId: id,
      recipientId: actor,
      active: true,
      allowCopy: true,
    });
    if (!row) throw new ForbiddenException('소유자가 허용한 받은 자료만 복제할 수 있습니다.');
    return row;
  }
  private async capture(id: number, actor: number, manager: EntityManager) {
    const row = await this.context(id, actor, manager);
    const captured = await this.studio.captureRemix(id, actor, manager);
    const latest = await this.context(id, actor, manager);
    if (
      latest.version !== row.version ||
      latest.ownerId !== row.ownerId ||
      latest.organizationId !== row.organizationId
    )
      throw new ConflictException('공유 설정이 변경되었습니다. 받은 자료에서 다시 시작해 주세요.');
    return { row, ...captured };
  }
  async reference(id: number, actor: number) {
    return this.studio.serializeWrite(async () => {
      const { row, fingerprint } = await this.capture(id, actor, this.db.manager);
      return {
        reference: `d-${row.organizationId}-${row.ownerId}-${id}-${row.version}-${fingerprint}`,
      };
    });
  }
  readonly resolve = async (
    reference: string,
    actor: number,
    expectedVersion?: number,
    manager = this.db.manager,
  ) => {
    const parsed = typeof reference === 'string' && REFERENCE.exec(reference);
    if (!parsed || parsed.slice(1, 5).some(value => !Number.isSafeInteger(Number(value))))
      throw new BadRequestException('받은 자료 복제 기준을 확인해 주세요.');
    const [, org, owner, id, version, fingerprint] = parsed;
    const current = await this.capture(Number(id), actor, manager);
    if (
      current.row.organizationId !== Number(org) ||
      current.row.ownerId !== Number(owner) ||
      current.row.version !== Number(version) ||
      current.fingerprint !== fingerprint ||
      (expectedVersion !== undefined && expectedVersion !== current.row.version)
    )
      throw new ConflictException(
        '원본 또는 공유 설정이 변경되었습니다. 받은 자료에서 다시 시작해 주세요.',
      );
    return { version: current.row.version, remixTemplate: JSON.stringify(current.template) };
  };
}
