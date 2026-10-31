import { create } from 'axios';
import { z } from 'zod';
import { del, get, post, postForm } from '@/helpers/apiHelper';

const positive = z.number().int().positive().safe();
const uuid = z.string().uuid();
const summarySchema = z.object({
  id: uuid,
  kind: z.enum(['html', 'pdf', 'pptx']),
  title: z.string().max(200),
  headVersion: positive,
  revision: positive,
  size: z.number().int().nonnegative().safe(),
  mimeType: z.string(),
  updatedAt: z.string(),
  shareActive: z.boolean(),
  safePreview: z.boolean(),
});
const detailSchema = summarySchema.extend({
  versions: z.array(
    z.object({
      version: positive,
      originalName: z.string(),
      mimeType: z.string(),
      byteSize: z.number().int().nonnegative().safe(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      createdAt: z.string(),
    }),
  ),
});
export type FileArtifactSummary = z.infer<typeof summarySchema>;
export type FileArtifactDetail = z.infer<typeof detailSchema>;
export type FileKind = FileArtifactSummary['kind'];
const root = '/artifacts/files';
const filePath = (id: string) => `${root}/${uuid.parse(id)}`;
const sharedPath = (token: string) => `/artifacts/shared/${encodeURIComponent(z.string().min(1).max(256).parse(token))}`;
const anonymous = create({ baseURL: import.meta.env.REACT_APP_API_URL, withCredentials: false });

export function fileUploadError(file: File, kind?: FileKind): 'invalidFile' | 'tooLarge' | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const detected: FileKind | undefined =
    extension === 'html' || extension === 'htm'
      ? 'html'
      : extension === 'pdf' || extension === 'pptx'
      ? extension
      : undefined;
  if (!detected || (kind && detected !== kind) || file.size === 0) return 'invalidFile';
  if (file.size > (detected === 'html' ? 5 : 20) * 1024 * 1024) return 'tooLarge';
  return null;
}

export const fileArtifactService = {
  async list(signal?: AbortSignal): Promise<FileArtifactSummary[]> {
    return z.object({ items: z.array(summarySchema) }).parse((await get(root, undefined, { signal })).data).items;
  },
  async detail(id: string, signal?: AbortSignal): Promise<FileArtifactDetail> {
    const detail = detailSchema.parse((await get(filePath(id), undefined, { signal })).data);
    if (detail.id !== id) throw new Error('Artifact mismatch');
    return detail;
  },
  async upload(file: File, title?: string): Promise<FileArtifactDetail> {
    const body = new FormData();
    body.append('file', file);
    if (title?.trim()) body.append('title', title.trim());
    return detailSchema.parse((await postForm(root, body, { _retry: true })).data);
  },
  async replace(id: string, file: File, expectedVersion: number): Promise<FileArtifactDetail> {
    const body = new FormData();
    body.append('file', file);
    body.append('expectedVersion', String(positive.parse(expectedVersion)));
    const detail = detailSchema.parse((await postForm(`${filePath(id)}/versions`, body, { _retry: true })).data);
    if (detail.id !== id) throw new Error('Artifact mismatch');
    return detail;
  },
  async content(id: string, version: number, signal?: AbortSignal): Promise<Blob> {
    return (
      await get(`${filePath(id)}/versions/${positive.parse(version)}/content`, undefined, { signal, responseType: 'blob' })
    ).data;
  },
  async share(id: string, expiresAt?: string): Promise<{ token: string; expiresAt: string | null }> {
    const result = (await post(`${filePath(id)}/share`, expiresAt ? { expiresAt } : {}, { _retry: true })).data;
    return {
      token: z.string().min(1).max(256).parse(result?.token),
      expiresAt: result?.expiresAt === null ? null : z.string().parse(result?.expiresAt),
    };
  },
  async revoke(id: string): Promise<void> {
    await del(`${filePath(id)}/share`, { _retry: true });
  },
  async remove(id: string, expectedRevision: number): Promise<void> {
    await del(filePath(id), { data: { expectedRevision: positive.parse(expectedRevision) }, _retry: true });
  },
  async shared(token: string, signal?: AbortSignal): Promise<FileArtifactSummary> {
    return summarySchema.parse((await anonymous.get(sharedPath(token), { signal })).data);
  },
  async sharedContent(token: string, signal?: AbortSignal): Promise<Blob> {
    return (await anonymous.get(`${sharedPath(token)}/content`, { signal, responseType: 'blob' })).data;
  },
};
