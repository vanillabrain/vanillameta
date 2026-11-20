import { z } from 'zod';
import { get } from '@/helpers/apiHelper';

const summarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['html', 'document', 'sheet', 'chart']),
  title: z.string().max(200),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
});
const detailSchema = summarySchema.extend({ content: z.record(z.unknown()) });

export type AiArtifactSummary = z.infer<typeof summarySchema>;
export type AiArtifactDetail = z.infer<typeof detailSchema>;
export type AiArtifactKind = AiArtifactSummary['kind'];

const root = '/ai-artifacts';
const artifactPath = (id: string) => `${root}/${z.string().uuid().parse(id)}`;

export const aiArtifactService = {
  async list(signal?: AbortSignal): Promise<AiArtifactSummary[]> {
    return z.object({ items: z.array(summarySchema) }).parse((await get(root, undefined, { signal })).data).items;
  },
  async detail(id: string, signal?: AbortSignal): Promise<AiArtifactDetail> {
    const detail = detailSchema.parse((await get(artifactPath(id), undefined, { signal })).data);
    if (detail.id !== id) throw new Error('Artifact mismatch');
    return detail;
  },
};
