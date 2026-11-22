import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { z } from 'mcp-zod';
import { AiArtifact } from './ai-artifact.entity';

export const artifactPageInput = z
  .object({
    query: z.string().max(200).optional(),
    cursor: z.string().min(1).max(180).optional(),
  })
  .strict();

const position = z.tuple([z.string().datetime(), z.string().uuid()]);
const pageSize = 50;

export async function artifactPage(builder: SelectQueryBuilder<AiArtifact>, input: unknown) {
  const parsed = artifactPageInput.safeParse(input);
  if (!parsed.success) throw new BadRequestException('Invalid artifact search');
  const { cursor, query } = parsed.data;
  if (cursor) {
    let after: z.infer<typeof position>;
    try {
      after = position.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    } catch {
      throw new BadRequestException('Invalid artifact cursor');
    }
    builder.andWhere(
      '(artifact.updatedAt < :time OR (artifact.updatedAt = :time AND artifact.id < :id))',
      {
        time: after[0],
        id: after[1],
      },
    );
  }
  const term = query?.normalize('NFKC').trim().toLowerCase();
  if (term) {
    const match =
      builder.connection.options.type === 'postgres'
        ? 'strpos(lower(normalize(artifact.title, NFKC)), :term) > 0'
        : 'instr(lower(artifact.title), :term) > 0';
    builder.andWhere(match, { term });
  }
  const rows = await builder
    .select([
      'artifact.id',
      'artifact.title',
      'artifact.kind',
      'artifact.revision',
      'artifact.updatedAt',
    ])
    .orderBy('artifact.updatedAt', 'DESC')
    .addOrderBy('artifact.id', 'DESC')
    .limit(pageSize + 1)
    .getMany();
  const items = rows.slice(0, pageSize);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > pageSize
        ? Buffer.from(JSON.stringify([last.updatedAt, last.id]), 'utf8').toString('base64url')
        : null,
  };
}
