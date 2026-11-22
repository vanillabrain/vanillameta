import { AiArtifactRevision } from './ai-artifact-revision.entity';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiArtifact } from './ai-artifact.entity';
import { AiArtifactsService } from './ai-artifacts.service';

const owner = { actorId: 1 };
const other = { actorId: 2 };

describe('AI artifacts', () => {
  let db: DataSource, service: AiArtifactsService;
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [AiArtifact, AiArtifactRevision],
      synchronize: true,
    }).initialize();
    service = new AiArtifactsService(db.getRepository(AiArtifact));
  });
  afterAll(() => db.destroy());

  it('creates and reads each kind for its owner', async () => {
    const html = await service.create(owner, 7, {
      kind: 'html',
      title: 'Web',
      content: { html: '<h1>Hello</h1>' },
    });
    const document = await service.create(owner, 7, {
      kind: 'document',
      title: 'Note',
      content: { markdown: '# Note' },
    });
    const sheet = await service.create(owner, 7, {
      kind: 'sheet',
      title: 'Table',
      content: { columns: ['a', 'b'], rows: [['x', 1]] },
    });
    const chart = await service.create(owner, 7, {
      kind: 'chart',
      title: 'Chart',
      content: { chartType: 'bar', labels: ['Jan'], series: [{ name: 's', data: [3] }] },
    });
    for (const created of [html, document, sheet, chart]) {
      expect(await service.get(owner, created.id)).toMatchObject({
        id: created.id,
        revision: 1,
      });
    }
    expect((await service.list(owner)).items).toHaveLength(4);
    await expect(service.get(other, html.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects content that does not match the kind', async () => {
    await expect(
      service.create(owner, 7, { kind: 'sheet', title: 'bad', content: { markdown: 'x' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(owner, 7, {
        kind: 'sheet',
        title: 'bad',
        content: { columns: ['a', 'b'], rows: [['only one']] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates with revision control and rejects stale revisions', async () => {
    const created = await service.create(owner, 7, {
      kind: 'document',
      title: 'Draft',
      content: { markdown: '# v1' },
    });
    const updated = await service.update(owner, {
      id: created.id,
      expectedRevision: 1,
      content: { markdown: '# v2' },
    });
    expect(updated).toMatchObject({ id: created.id, revision: 2, title: 'Draft' });
    expect((await service.revisions(owner, created.id)).revisions.map(row => row.revision)).toEqual(
      [2, 1],
    );
    expect(await service.revision(owner, created.id, 1)).toMatchObject({
      title: 'Draft',
      content: { markdown: '# v1' },
    });
    await expect(service.revision(other, created.id, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.get(owner, created.id)).content).toEqual({ markdown: '# v2' });
    await expect(
      service.update(owner, { id: created.id, expectedRevision: 1, title: 'stale' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update(other, { id: created.id, expectedRevision: 2, title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores as a new head and rejects stale, repeated and non-owner restores', async () => {
    const { id } = await service.create(owner, 7, {
      kind: 'document',
      title: 'First',
      content: { markdown: 'Initial' },
    });
    await service.update(owner, {
      id,
      expectedRevision: 1,
      title: 'Second',
      content: { markdown: 'Updated' },
    });
    await expect(service.restore(other, id, 1, { expectedRevision: 2 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const restored = await service.restore(owner, id, 1, { expectedRevision: 2 });
    expect(restored).toMatchObject({
      id,
      revision: 3,
      title: 'First',
      content: { markdown: 'Initial' },
    });
    await expect(service.restore(owner, id, 1, { expectedRevision: 2 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.restore(owner, id, 3, { expectedRevision: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await service.revisions(owner, id)).revisions.map(x => x.revision)).toEqual([3, 2, 1]);
    expect(await service.revision(owner, id, 2)).toMatchObject({
      title: 'Second',
      content: { markdown: 'Updated' },
    });
  });

  it('pages tied timestamps without gaps and searches older owned titles literally', async () => {
    const actor = { actorId: 400 };
    const ids = Array.from(
      { length: 54 },
      (_, index) => 'abcd0000-0000-4000-8000-' + index.toString(16).padStart(12, '0'),
    );
    for (const [i, id] of ids.entries()) {
      await db.manager.insert(AiArtifact, {
        id,
        ownerId: actor.actorId,
        organizationId: 7,
        kind: 'document',
        revision: 1,
        title: i === 0 ? 'Revenue 100%_done' : 'Revenue ' + i,
        content: { markdown: 'Private' },
        updatedAt: '2026-11-22T01:00:00.000Z',
        createdAt: '2026-11-22T01:00:00.000Z',
        deletedAt: null,
      });
    }
    const first = await service.list(actor);
    const last = await service.list(actor, { cursor: first.nextCursor });
    expect(first.items).toHaveLength(50);
    expect(last.nextCursor).toBeNull();
    expect([...first.items, ...last.items].map(row => row.id)).toEqual(ids.reverse());
    const matched = await service.list(actor, { query: '100%_DONE' });
    expect(matched.items).toHaveLength(1);
    expect(matched.items[0]).not.toHaveProperty('content');
    expect((await service.list(other, { query: '100%_done' })).items).toEqual([]);
    await expect(service.list(actor, { cursor: 'invalid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes once and hides the artifact afterwards', async () => {
    const created = await service.create(owner, 7, {
      kind: 'html',
      title: 'Bye',
      content: { html: '<p>bye</p>' },
    });
    expect(await service.delete(owner, { id: created.id, expectedRevision: 1 })).toEqual({
      id: created.id,
      deleted: true,
    });
    await expect(service.get(owner, created.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.delete(owner, { id: created.id, expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
