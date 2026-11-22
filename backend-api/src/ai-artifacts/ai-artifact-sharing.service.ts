import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { z } from 'zod';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import { AiArtifact } from './ai-artifact.entity';
import { AiArtifactShare } from './ai-artifact-share.entity';

@Injectable()
export class AiArtifactSharingService {
  constructor(private readonly db: DataSource) {}

  private received(actorId: number) {
    return this.db.getRepository(AiArtifact).createQueryBuilder('artifact')
      .innerJoin(AiArtifactShare, 'grantRow', 'grantRow.artifactId = artifact.id AND grantRow.recipientId = :actorId', { actorId })
      .innerJoin(EnterpriseMembership, 'sender', 'sender.userId = artifact.ownerId AND sender.organizationId = artifact.organizationId')
      .innerJoin(EnterpriseMembership, 'recipient', 'recipient.userId = grantRow.recipientId AND recipient.organizationId = artifact.organizationId')
      .innerJoin(User, 'ownerUser', 'ownerUser.id = sender.userId AND ownerUser.active = true AND ownerUser.authVersion = grantRow.ownerEpoch')
      .innerJoin(User, 'reader', 'reader.id = recipient.userId AND reader.active = true AND reader.authVersion = grantRow.recipientEpoch')
      .where('artifact.deletedAt IS NULL');
  }

  async list(actorId: number) {
    const items = await this.received(actorId)
      .select(['artifact.id','artifact.title','artifact.kind','artifact.revision','artifact.updatedAt'])
      .orderBy('artifact.updatedAt', 'DESC').take(50).getMany();
    return { items };
  }

  async read(actorId: number, id: string) {
    const row = await this.received(actorId).andWhere('artifact.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException();
    const { kind, title, content, revision, updatedAt } = row;
    return { id, kind, title, content, revision, updatedAt, role: 'recipient' };
  }

  async set(ownerId: number, id: string, input: unknown) {
    const body = z.object({ login: z.string().trim().min(1).max(255), active: z.boolean() }).strict().safeParse(input);
    if (!body.success) throw new BadRequestException();
    return this.db.transaction(async manager => {
      const artifact = await manager.findOneBy(AiArtifact, { id, ownerId, deletedAt: IsNull() });
      if (!artifact) throw new NotFoundException();
      const recipient = await manager.findOne(User, { where: { userId: body.data.login }, select: ['id','authVersion','active'] });
      if (!recipient || recipient.id === ownerId) throw new BadRequestException('Invalid recipient');
      const key = { artifactId: id, recipientId: recipient.id };
      if (!body.data.active) {
        await manager.delete(AiArtifactShare, key);
        return { active: false };
      }
      const org = artifact.organizationId;
      if (!org || !recipient.active) throw new BadRequestException('Invalid recipient');
      const sender = await manager.findOneBy(User, { id: ownerId, active: true });
      const members = await manager.countBy(EnterpriseMembership, [
        { userId: ownerId, organizationId: org }, { userId: recipient.id, organizationId: org },
      ]);
      if (!sender || members !== 2) throw new BadRequestException('Invalid recipient');
      await manager.upsert(AiArtifactShare, { ...key, ownerEpoch: sender.authVersion, recipientEpoch: recipient.authVersion }, ['artifactId','recipientId']);
      return { active: true };
    });
  }
}
