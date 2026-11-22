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
