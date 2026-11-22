import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';

const summarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['html', 'document', 'sheet', 'chart']),
  title: z.string().max(200),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
});
const detailSchema = summarySchema.extend({
  role: z.enum(['owner', 'recipient']).optional(),
  content: z.record(z.unknown()),
});

export type AiArtifactSummary = z.infer<typeof summarySchema>;
export type AiArtifactDetail = z.infer<typeof detailSchema>;
export type AiArtifactKind = AiArtifactSummary['kind'];

const root = '/ai-artifacts';
const artifactPath = (id: string) => `${root}/${z.string().uuid().parse(id)}`;

export const aiArtifactService = {
  async page(scope: 'mine' | 'shared', query: string, cursor: string | null, signal?: AbortSignal) {
    const path = scope === 'shared' ? root + '/received' : root;
    const params = { ...(query && { query }), ...(cursor && { cursor }) };
    const response = await get(path, params, { signal });
    return z.object({ items: z.array(summarySchema), nextCursor: z.string().nullish() }).parse(response.data);
  },
  async recipients(id: string, signal?: AbortSignal) {
    const result = await get(artifactPath(id) + '/shares', undefined, { signal });
    return z.object({ recipients: z.array(z.object({ login: z.string() })) }).parse(result.data).recipients;
  },
  async share(id: string, login: string, active: boolean) {
    return z.object({ active: z.boolean() }).parse((await post(artifactPath(id) + '/share', { login, active })).data);
  },
  async revisions(id: string, signal?: AbortSignal) {
    const result = await get(artifactPath(id) + '/revisions', undefined, { signal });
    return z.object({ revisions: z.array(summarySchema.pick({ revision: true, updatedAt: true })) }).parse(result.data)
      .revisions;
  },
  async revision(id: string, revision: number, signal?: AbortSignal): Promise<AiArtifactDetail> {
    const result = await get(artifactPath(id) + '/revisions/' + revision, undefined, { signal });
    const detail = detailSchema.parse(result.data);
    if (detail.id !== id || detail.revision !== revision) throw new Error('Artifact revision mismatch');
    return detail;
  },
  async restore(id: string, revision: number, expectedRevision: number): Promise<AiArtifactDetail> {
    const response = await post(
      artifactPath(id) + '/revisions/' + revision + '/restore',
      { expectedRevision },
      { _retry: true },
    );
    const detail = detailSchema.parse(response.data);
    if (detail.id !== id || detail.revision !== expectedRevision + 1 || detail.role !== 'owner')
      throw new Error('Artifact restore mismatch');
    return detail;
  },
  async detail(id: string, signal?: AbortSignal): Promise<AiArtifactDetail> {
    const detail = detailSchema.parse((await get(artifactPath(id), undefined, { signal })).data);
    if (detail.id !== id) throw new Error('Artifact mismatch');
    return detail;
  },
};
