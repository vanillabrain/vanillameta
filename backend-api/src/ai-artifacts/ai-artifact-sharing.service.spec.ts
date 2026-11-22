import { AiArtifactRevision } from './ai-artifact-revision.entity';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import { AiArtifactShare } from './ai-artifact-share.entity';
import { AiArtifactSharingService } from './ai-artifact-sharing.service';
import { AiArtifact } from './ai-artifact.entity';
import { AiArtifactsService } from './ai-artifacts.service';

it('limits received charts to an explicit current grant and keeps authoring owner-only', async () => {
  const db = await new DataSource({
    type: 'sqlite', database: ':memory:', synchronize: true,
    entities: [AiArtifact, AiArtifactRevision, AiArtifactShare, User, EnterpriseMembership],
  }).initialize();
  try {
    const owner = await db.manager.save(User, { userId: 'author', email: 'owner@example.invalid', password: 'unused' });
    const reader = await db.manager.save(User, { userId: 'reader', email: 'reader@example.invalid', password: 'unused' });
    for (const user of [owner, reader]) {
      await db.manager.insert(EnterpriseMembership, { userId: user.id, organizationId: 1, role: 'member' });
    }
    const authoring = new AiArtifactsService(db.getRepository(AiArtifact));
    const sharing = new AiArtifactSharingService(db);
    const { id } = await authoring.create({ actorId: owner.id }, 1, {
      kind: 'chart', title: 'Sales', content: { chartType: 'bar', labels: ['Busan'], series: [{ name: 'Sales', data: [100] }] },
    });
    const grant = { login: reader.userId, active: true };
    await expect(sharing.read(reader.id, id)).rejects.toBeInstanceOf(NotFoundException);
    await sharing.set(owner.id, id, grant);
    await sharing.set(owner.id, id, grant);
    expect((await sharing.list(reader.id)).items.map(row => row.id)).toEqual([id]);
    expect(await sharing.read(reader.id, id)).toMatchObject({ role: 'recipient', revision: 1 });
    await expect(authoring.update({ actorId: reader.id }, { id, expectedRevision: 1, title: 'Changed' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(sharing.set(reader.id, id, { login: owner.userId, active: true })).rejects.toBeInstanceOf(NotFoundException);
    await sharing.set(owner.id, id, { ...grant, active: false });
    await expect(sharing.read(reader.id, id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await sharing.list(reader.id)).items).toHaveLength(0);
    await sharing.set(owner.id, id, grant);
    await db.manager.update(User, reader.id, { authVersion: 1 });
    expect((await sharing.list(reader.id)).items).toHaveLength(0);
    expect(await authoring.get({ actorId: owner.id }, id)).toMatchObject({ title: 'Sales', revision: 1 });
  } finally {
    await db.destroy();
  }
});
