import { ForbiddenException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { lockDashboardWrite } from './dashboard-write-lock';

/** Fence existing parents before authorization; source read never conveys another owner's block. */
export async function lockWidgetAttachmentParents(
  manager: EntityManager,
  widgetIds: number[],
  actor: number | undefined,
  targetId?: number,
) {
  const findLinks = () =>
    widgetIds.length
      ? manager.find(DashboardWidget, { where: { widgetId: In(widgetIds) }, order: { id: 'ASC' } })
      : Promise.resolve([]);
  const before = await findLinks();
  const ids = [
    ...new Set([...before.map(l => l.dashboardId), ...(targetId ? [targetId] : [])]),
  ].sort((a, b) => a - b);
  const parents = new Map();
  for (const id of ids) parents.set(id, await lockDashboardWrite(manager, id));
  // A newly discovered parent cannot be safely locked out of order: fail without a write.
  const current = await findLinks();
  if (current.some(l => !parents.has(l.dashboardId)))
    throw new ForbiddenException('위젯 연결이 변경되었습니다. 다시 확인해 주세요.');
  const ownLinks = new Set(current.filter(l => l.dashboardId === targetId).map(l => l.widgetId));
  const newIds = new Set(widgetIds.filter(id => !ownLinks.has(id)));
  for (const id of new Set(current.filter(l => newIds.has(l.widgetId)).map(l => l.dashboardId))) {
    const owners = await manager.find(UserMapping, { where: { dashboardId: id } });
    if (
      !Number.isSafeInteger(actor) ||
      actor <= 0 ||
      owners.length !== 1 ||
      owners[0].userInfoId !== actor
    )
      throw new ForbiddenException('다른 소유자의 대시보드 위젯은 연결할 수 없습니다.');
  }
  if (newIds.size && (!Number.isSafeInteger(actor) || actor <= 0))
    throw new ForbiddenException('새 위젯 연결의 소유자를 확인해 주세요.');
  return targetId ? parents.get(targetId) : undefined;
}
