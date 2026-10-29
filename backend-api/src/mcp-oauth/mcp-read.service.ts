import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from '../bi/bi.service';
import { DocumentsService } from '../documents/documents.service';
import { McpOAuthService } from './mcp-oauth.service';

export type McpPrincipal = Awaited<ReturnType<McpOAuthService['authenticateBearer']>>;
@Injectable()
export class McpReadService {
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly bi: BiService,
    private readonly documents: DocumentsService,
    private readonly auth: McpOAuthService,
  ) {}

  private async source(principal: McpPrincipal, id: number) {
    await this.auth.revalidate(principal);
    const row = await this.db.manager.findOneBy(Database, { id });
    const membership =
      row && (await this.db.manager.findOneBy(EnterpriseMembership, { userId: row.ownerId }));
    if (!row || membership?.organizationId !== principal.organizationId)
      throw new ForbiddenException();
    await this.access.assert('database', id, principal.actorId, 'read');
  }

  async sources(principal: McpPrincipal, afterId: number) {
    await this.auth.revalidate(principal);
    const grants = await this.access.readableSourceIds(principal.actorId);
    const query = this.db
      .getRepository(Database)
      .createQueryBuilder('source')
      .innerJoin(EnterpriseMembership, 'membership', 'membership.userId = source.ownerId')
      .where('membership.organizationId = :org', { org: principal.organizationId })
      .andWhere('source.catalogActive = :active', { active: true })
      .andWhere('source.id > :after', { after: afterId })
      .andWhere(
        grants.length
          ? '(source.ownerId = :actor OR source.id IN (:...grants))'
          : 'source.ownerId = :actor',
        { actor: principal.actorId, grants },
      )
      .select(['source.id', 'source.name', 'source.engine'])
      .orderBy('source.id', 'ASC')
      .take(51);
    const rows = await query.getMany();
    const visible = rows.slice(0, 50);
    for (const row of visible) await this.source(principal, row.id);
    await this.auth.revalidate(principal);
    return {
      sources: visible.map(({ id, name, engine }) => ({ id, name, engine })),
      nextAfterId: rows.length > 50 ? visible[visible.length - 1].id : null,
    };
  }

  async describe(principal: McpPrincipal, id: number) {
    await this.source(principal, id);
    const profile = await this.bi.profile(id, principal.actorId);
    await this.source(principal, id);
    return {
      sourceId: id,
      name: profile.name,
      engine: profile.engine,
      supported: profile.supported === true,
      status: profile.supported === true ? 'ready' : 'unsupported',
      columns: profile.columns.map(column => ({ name: column.name, type: column.type })),
    };
  }

  async documentList(principal: McpPrincipal) {
    await this.auth.revalidate(principal);
    const list = await this.documents.list({
      id: principal.actorId,
      authVersion: principal.authVersion,
    });
    await this.auth.revalidate(principal);
    if (list.organizationId !== principal.organizationId) throw new ForbiddenException();
    return {
      documents: list.documents.map(({ id, title, currentVersion, updatedAt }) => ({
        id,
        title,
        currentVersion,
        updatedAt,
      })),
    };
  }

  async document(principal: McpPrincipal, id: string, version: number, offset: number) {
    await this.auth.revalidate(principal);
    const snapshot = await this.documents.read(
      { id: principal.actorId, authVersion: principal.authVersion },
      id,
      version,
    );
    if (!('markdown' in snapshot)) throw new ForbiddenException();
    await this.auth.revalidate(principal);
    const points = Array.from(snapshot.markdown);
    const end = Math.min(offset + 12000, points.length);
    return {
      documentId: id,
      version: snapshot.version,
      sourceVersion: snapshot.sourceVersion,
      sha256: snapshot.sha256,
      offset,
      markdown: points.slice(offset, end).join(''),
      nextOffset: end < points.length ? end : null,
      totalCharacters: points.length,
    };
  }
}
