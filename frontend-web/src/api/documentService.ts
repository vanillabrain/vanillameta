import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';

const uuid = z.string().uuid();
const version = z.number().int().nonnegative();
const sourceUrl = z
  .string()
  .url()
  .refine(value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (url.hostname === 'docs.google.com') return /^\/document\/d\/[a-zA-Z0-9_-]{10,200}(?:\/|$)/.test(url.pathname);
    return url.hostname === 'onedrive.live.com' || url.hostname.endsWith('.sharepoint.com');
  });
const summarySchema = z.object({
  role: z.enum(['owner', 'recipient']).default('owner'),
  id: uuid,
  title: z.string(),
  sourceUrl,
  currentVersion: version,
  connected: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }),
});
const versionSchema = z.object({
  version: z.number().int().positive(),
  sourceVersion: z.string(),
  sourceModifiedAt: z.string().datetime({ offset: true }),
  capturedAt: z.string().datetime({ offset: true }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z
    .number()
    .int()
    .min(0)
    .max(2 * 1024 * 1024),
});
const snapshotSchema = versionSchema.extend({ markdown: z.string().max(2 * 1024 * 1024) });
const listSchema = z.object({
  configured: z.boolean(),
  organizationId: z.number().int().positive().nullable(),
  documents: z.array(summarySchema),
});
const detailSchema = summarySchema.extend({ versions: z.array(versionSchema), snapshot: snapshotSchema.nullable() });
const resultSchema = z.object({ documentId: uuid, version, unchanged: z.boolean() });
const requestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.literal('running') }),
  z.object({ status: z.literal('failed') }),
  z.object({ status: z.literal('completed'), result: resultSchema }),
]);
export type DocumentSummary = z.infer<typeof summarySchema>;
export type DocumentDetail = z.infer<typeof detailSchema>;
export type DocumentSnapshot = z.infer<typeof snapshotSchema>;
export type DocumentList = z.infer<typeof listSchema>;
export type RefreshResult = z.infer<typeof resultSchema>;
export type RefreshRequest = z.infer<typeof requestSchema>;

export function validateGoogleAuthorizationUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'accounts.google.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/o/oauth2/v2/auth' ||
    url.hash
  )
    throw new Error('Invalid Google authorization URL');
  return url.href;
}

export const documentService = {
  async list(signal?: AbortSignal): Promise<DocumentList> {
    return listSchema.parse((await get('/documents', undefined, { signal })).data);
  },
  async detail(id: string, signal?: AbortSignal): Promise<DocumentDetail> {
    const data = detailSchema.parse((await get(`/documents/${uuid.parse(id)}`, undefined, { signal })).data);
    if (data.id !== id) throw new Error('Document mismatch');
    return data;
  },
  async snapshot(id: string, selectedVersion: number): Promise<DocumentSnapshot> {
    const data = snapshotSchema.parse(
      (await get(`/documents/${uuid.parse(id)}/versions/${version.parse(selectedVersion)}`)).data,
    );
    if (data.version !== selectedVersion) throw new Error('Version mismatch');
    return data;
  },
  async start(input: { sourceUrl: string; documentId?: string }): Promise<string> {
    sourceUrl.parse(input.sourceUrl);
    if (input.documentId) uuid.parse(input.documentId);
    const data = z
      .object({ authorizationUrl: z.string() })
      .parse((await post('/documents/google/start', input, { _retry: true })).data);
    return validateGoogleAuthorizationUrl(data.authorizationUrl);
  },
  async complete(input: { state: string; code: string; pickedFileIds: string }): Promise<string> {
    return z
      .object({ documentId: uuid })
      .parse((await post('/documents/google/complete', input, { timeout: 90000, _retry: true })).data).documentId;
  },
  async refresh(id: string, input: { requestId: string; expectedVersion: number }): Promise<RefreshResult> {
    uuid.parse(input.requestId);
    version.parse(input.expectedVersion);
    const result = resultSchema.parse(
      (await post(`/documents/${uuid.parse(id)}/refresh`, input, { timeout: 90000, _retry: true })).data,
    );
    if (result.documentId !== id) throw new Error('Document mismatch');
    return result;
  },
  async request(id: string, requestId: string): Promise<RefreshRequest> {
    const result = requestSchema.parse((await get(`/documents/${uuid.parse(id)}/requests/${uuid.parse(requestId)}`)).data);
    if (result.status === 'completed' && result.result.documentId !== id) throw new Error('Document mismatch');
    return result;
  },
  async disconnect(id: string): Promise<void> {
    z.object({ disconnected: z.literal(true) }).parse(
      (await post(`/documents/${uuid.parse(id)}/disconnect`, {}, { _retry: true })).data,
    );
  },
  async integrations() {
    return z
      .object({ googleDocs: z.boolean(), microsoft: z.boolean(), sheets: z.boolean() })
      .parse((await get('/documents/integrations')).data);
  },
  async sheetsAuthorization(verifier: string) {
    return z
      .object({ authorizationUrl: z.string().url(), state: z.string().min(16) })
      .parse((await get('/documents/sheets/authorization', { verifier })).data);
  },
  async sheetsImport(input: { code: string; verifier: string; spreadsheetId: string; range: string; name: string }) {
    return z
      .object({
        databaseId: z.number().int().positive(),
        name: z.string(),
        columns: z.array(z.string()),
        rowCount: z.number().int().nonnegative(),
      })
      .parse((await post('/documents/sheets/import', input, { timeout: 190000 })).data);
  },
  async microsoftAuthorization(verifier: string) {
    return z
      .object({ authorizationUrl: z.string().url(), state: z.string().min(16) })
      .parse((await get('/documents/microsoft/authorization', { verifier })).data);
  },
  async microsoftPreview(input: { code: string; verifier: string; itemId: string }) {
    return z
      .object({
        id: z.string(),
        name: z.string(),
        mimeType: z.string(),
        lastModifiedAt: z.string().nullable(),
        markdown: z.string().max(2 * 1024 * 1024),
      })
      .parse((await post('/documents/microsoft/preview', input, { timeout: 190000 })).data);
  },
  async microsoftSave(input: { code: string; verifier: string; itemId: string }) {
    return z
      .object({ documentId: z.string().uuid(), version: z.number().int().positive(), title: z.string() })
      .parse((await post('/documents/microsoft/save', input, { timeout: 190000 })).data);
  },
  async aiSummary(id: string, input: { confirmAiCost: true; version?: number }) {
    const result = z
      .object({
        documentId: uuid,
        version: z.number().int().positive(),
        summary: z.string().min(1).max(4000),
        generatedAt: z.string(),
        cached: z.boolean(),
      })
      .parse((await post(`/documents/${uuid.parse(id)}/summary`, input, { timeout: 190000 })).data);
    if (result.documentId !== id) throw new Error('Document mismatch');
    return result;
  },
  async shares(id: string) {
    return z
      .array(
        z.object({
          recipientId: z.number().int().positive(),
          active: z.boolean(),
          createdAt: z.string(),
          revokedAt: z.string().nullable(),
        }),
      )
      .parse((await get('/documents/' + uuid.parse(id) + '/shares')).data);
  },
  async share(id: string, input: { recipientId: number; active: boolean }) {
    return z
      .object({ documentId: uuid, recipientId: z.number().int().positive(), active: z.boolean() })
      .parse((await post('/documents/' + uuid.parse(id) + '/shares', input)).data);
  },
};
