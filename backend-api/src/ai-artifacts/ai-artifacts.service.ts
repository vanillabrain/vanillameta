import { artifactPage } from './ai-artifact-page';
import { AiArtifactRevision } from './ai-artifact-revision.entity';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { z } from 'zod';
import { AiArtifact, AiArtifactKind } from './ai-artifact.entity';

export type AiArtifactActor = { actorId: number };

const htmlContent = z.object({ html: z.string().min(1).max(200_000) }).strict();
const documentContent = z.object({ markdown: z.string().min(1).max(200_000) }).strict();
const cell = z.union([z.string().max(10_000), z.number().finite(), z.boolean(), z.null()]);
const sheetContent = z
  .object({
    columns: z.array(z.string().min(1).max(200)).min(1).max(40),
    rows: z.array(z.array(cell).max(40)).max(1_000),
  })
  .strict()
  .refine(value => value.rows.every(row => row.length === value.columns.length), {
    message: 'each row must have the same number of cells as columns',
  });
const chartSeries = z
  .object({
    name: z.string().min(1).max(100),
    data: z.array(z.number().finite()).min(1).max(1_000),
  })
  .strict();
const chartContent = z
  .object({
    chartType: z.enum(['bar', 'line']),
    labels: z.array(z.string().max(200)).min(1).max(1_000),
    series: z.array(chartSeries).min(1).max(8),
  })
  .strict()
  .refine(value => value.series.every(series => series.data.length === value.labels.length), {
    message: 'each series must have one value per label',
  });

export const aiArtifactContentSchemas: Record<AiArtifactKind, z.ZodTypeAny> = {
  html: htmlContent,
  document: documentContent,
  sheet: sheetContent,
  chart: chartContent,
};

const kindSchema = z.enum(['html', 'document', 'sheet', 'chart']);
const titleSchema = z.string().trim().min(1).max(200);
const idSchema = z.string().uuid();
const revisionSchema = z.number().int().positive();

export type AiArtifactSummary = {
  id: string;
  kind: AiArtifactKind;
  title: string;
  revision: number;
  updatedAt: string;
};

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(
      `${message}: ${result.error.issues[0]?.message ?? 'invalid input'}`,
    );
  }
  return result.data;
}

@Injectable()
export class AiArtifactsService {
  constructor(@InjectRepository(AiArtifact) private readonly repository: Repository<AiArtifact>) {}

  private summary(row: AiArtifact): AiArtifactSummary {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      revision: row.revision,
      updatedAt: row.updatedAt,
    };
  }

  async create(
    actor: AiArtifactActor,
    organizationId: number,
    input: { kind: unknown; title: unknown; content: unknown },
  ) {
    const kind = parse(kindSchema, input.kind, 'kind') as AiArtifactKind;
    const title = parse(titleSchema, input.title, 'title');
    const content = parse(aiArtifactContentSchemas[kind], input.content, `${kind} content`);
    const now = new Date().toISOString();
    const row: AiArtifact = {
      id: randomUUID(),
      ownerId: actor.actorId,
      organizationId,
      kind,
      title,
      content: content as Record<string, unknown>,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await this.repository.insert(row);
    return this.summary(row);
  }

  async list(actor: AiArtifactActor, input: unknown = {}) {
    const owned = this.repository
      .createQueryBuilder('artifact')
      .where('artifact.ownerId = :actor AND artifact.deletedAt IS NULL', { actor: actor.actorId });
    return artifactPage(owned, input);
  }

  async get(actor: AiArtifactActor, id: string) {
    const artifactId = parse(idSchema, id, 'id');
    const row = await this.repository.findOneBy({
      id: artifactId,
      ownerId: actor.actorId,
      deletedAt: IsNull(),
    });
    if (!row) throw new NotFoundException();
    return { ...this.summary(row), content: row.content };
  }

  async revisions(actor: AiArtifactActor, id: string) {
    const current = await this.get(actor, id);
    const history = await this.repository.manager.find(AiArtifactRevision, {
      where: { artifactId: id },
      select: { revision: true, updatedAt: true },
      order: { revision: 'DESC' },
    });
    return {
      revisions: [
        { revision: current.revision, updatedAt: current.updatedAt },
        ...history.filter(entry => entry.revision < current.revision),
      ],
    };
  }

  async revision(actor: AiArtifactActor, id: string, revision: number) {
    const current = await this.get(actor, id);
    if (current.revision === revision) return current;
    const saved = await this.repository.manager.findOneBy(AiArtifactRevision, {
      artifactId: id,
      revision,
    });
    if (!saved) throw new NotFoundException();
    return {
      id,
      kind: current.kind,
      title: saved.title,
      content: saved.content,
      revision,
      updatedAt: saved.updatedAt,
    };
  }

  async restore(actor: AiArtifactActor, id: string, revision: number, input: unknown) {
    const { expectedRevision } = parse(
      z.object({ expectedRevision: revisionSchema }).strict(),
      input,
      'restore',
    );
    const source = await this.revision(actor, id, revision);
    if (revision >= expectedRevision) throw new BadRequestException('Choose a previous revision');
    const head = await this.update(actor, {
      id,
      expectedRevision,
      title: source.title,
      content: source.content,
    });
    return { ...head, content: source.content, role: 'owner' as const };
  }

  async update(
    actor: AiArtifactActor,
    input: { id: unknown; expectedRevision: unknown; title?: unknown; content?: unknown },
  ) {
    const id = parse(idSchema, input.id, 'id');
    const expectedRevision = parse(revisionSchema, input.expectedRevision, 'expectedRevision');
    const current = await this.repository.findOneBy({
      id,
      ownerId: actor.actorId,
      deletedAt: IsNull(),
    });
    if (!current) throw new NotFoundException();
    if (current.revision !== expectedRevision) throw new ConflictException('revision mismatch');
    const title =
      input.title === undefined ? current.title : parse(titleSchema, input.title, 'title');
    const content =
      input.content === undefined
        ? current.content
        : (parse(
            aiArtifactContentSchemas[current.kind],
            input.content,
            `${current.kind} content`,
          ) as Record<string, unknown>);
    const updatedAt = new Date().toISOString();
    await this.repository.manager.transaction(async manager => {
      const result = await manager
        .getRepository(AiArtifact)
        .createQueryBuilder()
        .update()
        .set({ title, content, revision: current.revision + 1, updatedAt })
        .where(
          'id = :id AND "ownerId" = :ownerId AND revision = :revision AND "deletedAt" IS NULL',
          {
            id,
            ownerId: actor.actorId,
            revision: expectedRevision,
          },
        )
        .execute();
      if (!result.affected) throw new ConflictException('revision mismatch');
      await manager.insert(AiArtifactRevision, {
        artifactId: id,
        revision: current.revision,
        title: current.title,
        content: current.content,
        updatedAt: current.updatedAt,
      });
    });
    return {
      ...this.summary({ ...current, title, content, revision: current.revision + 1, updatedAt }),
    };
  }

  async delete(actor: AiArtifactActor, input: { id: unknown; expectedRevision: unknown }) {
    const id = parse(idSchema, input.id, 'id');
    const expectedRevision = parse(revisionSchema, input.expectedRevision, 'expectedRevision');
    const updatedAt = new Date().toISOString();
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({ deletedAt: updatedAt, updatedAt })
      .where('id = :id AND "ownerId" = :ownerId AND revision = :revision AND "deletedAt" IS NULL', {
        id,
        ownerId: actor.actorId,
        revision: expectedRevision,
      })
      .execute();
    if (!result.affected) {
      const current = await this.repository.findOneBy({ id, ownerId: actor.actorId });
      if (!current || current.deletedAt) throw new NotFoundException();
      throw new ConflictException('revision mismatch');
    }
    return { id, deleted: true };
  }
}
