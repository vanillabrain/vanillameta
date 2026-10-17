import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';

const PAGE_SIZE = 20;
/** UC050: direct source references only; never a claim of complete downstream impact. */
@Injectable()
export class SourceCatalogUsageService {
  constructor(private readonly db: DataSource, private readonly access: SourceAccessService) {}
  async list(body: any, actor: number) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => !['sourceId', 'kind', 'afterId'].includes(key)) ||
      !['metrics', 'analyses'].includes(body.kind)
    )
      throw new BadRequestException('사용처 조회 조건을 확인해 주세요.');
    const afterId = body.afterId === undefined ? 0 : body.afterId;
    if (
      !Number.isSafeInteger(afterId) ||
      afterId < 0 ||
      (body.afterId !== undefined && afterId === 0)
    )
      throw new BadRequestException('다음 조회 위치를 확인해 주세요.');
    const actorId = this.access.actor(actor);
    const sourceId = this.access.id(body.sourceId);
    await this.access.assert('database', sourceId, actorId);
    const entries: Array<{ id: number; title: string }> = [];
    let nextAfterId: number | null = null;
    if (body.kind === 'metrics') {
      const rows = await this.db.getRepository(Metric).find({
        where: { databaseId: sourceId, useYn: 'Y', id: MoreThan(afterId) },
        select: ['id', 'name', 'definition'],
        order: { id: 'ASC' },
        take: PAGE_SIZE + 1,
      });
      for (const row of rows.slice(0, PAGE_SIZE)) {
        let title = row.name;
        try {
          const label = JSON.parse(row.definition)?.label;
          if (typeof label === 'string' && label.trim() && label.length <= 100) title = label;
        } catch {
          /* Legacy/corrupt descriptions retain their safe registered name. */
        }
        entries.push({ id: row.id, title });
      }
      if (rows.length > PAGE_SIZE) nextAfterId = rows[PAGE_SIZE - 1].id;
    } else {
      const rows = await this.db
        .getRepository(Dashboard)
        .createQueryBuilder('dashboard')
        .innerJoin(UserMapping, 'mapping', 'mapping.dashboardId = dashboard.id')
        .where('mapping.userInfoId = :actor', { actor: actorId })
        .andWhere('dashboard.delYn = :active', { active: 'N' })
        .andWhere('dashboard.analysisDefinition IS NOT NULL')
        .andWhere('dashboard.id > :afterId', { afterId })
        .select(['dashboard.id', 'dashboard.title', 'dashboard.analysisDefinition'])
        .orderBy('dashboard.id', 'ASC')
        .take(PAGE_SIZE + 1)
        .getMany();
      for (const row of rows.slice(0, PAGE_SIZE)) {
        let definition: any;
        try {
          definition = JSON.parse(row.analysisDefinition);
        } catch {
          continue;
        }
        if (!definition || definition.databaseId !== sourceId) continue;
        try {
          await this.access.assert('dashboard', row.id, actorId);
        } catch (error) {
          if (error instanceof ForbiddenException) continue;
          throw error;
        }
        entries.push({ id: row.id, title: row.title });
      }
      // Advance by examined candidates, even if none matched. Never claim an empty page is a global zero.
      if (rows.length > PAGE_SIZE) nextAfterId = rows[PAGE_SIZE - 1].id;
    }
    return { sourceId, kind: body.kind, entries, nextAfterId };
  }
}
