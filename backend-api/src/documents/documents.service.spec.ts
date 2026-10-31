import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import {
  DOCUMENT_ENTITIES,
  DocumentAuthorization,
  DocumentChunk,
  DocumentConnection,
  DocumentRefresh,
  DocumentVersion,
} from './document.entity';
import { GoogleDocsProvider, GOOGLE_DOCUMENT_MIME } from './google-docs.provider';
import { DocumentSummary } from './document-summary.entity';
import { DocumentShare } from './document-share.entity';
import { DocumentsService } from './documents.service';
import { seal, unseal } from './document-crypto';
import { AddDocumentConnections1793232000000 } from '../migrations/1793232000000-add-document-connections';

const hashState = (state: string) => createHash('sha256').update(state).digest('hex');
const actor = { id: 1, authVersion: 0 };
const fileId = 'abcdefghijk123';
const sourceUrl = `https://docs.google.com/document/d/${fileId}/edit`;
const credentials = {
  accessToken: 'synthetic-access',
  refreshToken: 'synthetic-refresh',
  expiresAt: Date.now() + 600000,
};
const metadata = {
  id: fileId,
  name: 'Stored document',
  mimeType: GOOGLE_DOCUMENT_MIME,
  version: '1',
  modifiedTime: '2026-10-29T00:00:00.000Z',
  trashed: false as const,
  capabilities: { canDownload: true as const },
} satisfies Awaited<ReturnType<GoogleDocsProvider['metadata']>>;
function captured(markdown = '# Independent copy 🥔') {
  return {
    metadata,
    markdown,
    byteSize: Buffer.byteLength(markdown),
    sha256: createHash('sha256').update(markdown).digest('hex'),
  };
}
describe('Document persistence on real SQLite', () => {
  let db: DataSource;
  let service: DocumentsService;
  let provider: GoogleDocsProvider;
  const previousKey = process.env.CONFIG_SECRET_KEY;
  beforeAll(() => {
    process.env.CONFIG_SECRET_KEY = 'document-test-only-key';
  });
  afterAll(() => {
    if (previousKey === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = previousKey;
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, EnterpriseOrganization, EnterpriseMembership, ...DOCUMENT_ENTITIES],
      synchronize: true,
    }).initialize();
    await db.manager.insert(
      User,
      [1, 2].map(id => ({
        id,
        userId: `actor${id}`,
        email: `actor${id}@test.invalid`,
        password: 'synthetic',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseOrganization, { id: 1, name: 'Local org', version: 1 });
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2].map(userId => ({ userId, organizationId: 1, role: 'member', team: '' })),
    );
    provider = new GoogleDocsProvider();
    jest.spyOn(provider, 'configured').mockReturnValue(true);
    jest
      .spyOn(provider, 'authorizationUrl')
      .mockImplementation(({ state }) => `https://accounts.google.com/?state=${state}`);
    jest.spyOn(provider, 'exchange').mockResolvedValue(credentials);
    jest.spyOn(provider, 'metadata').mockImplementation(async id => ({ ...metadata, id }));
    jest.spyOn(provider, 'renew').mockResolvedValue(credentials);
    jest.spyOn(provider, 'snapshot').mockResolvedValue(captured());
    service = new DocumentsService(db, provider, { generate: jest.fn() } as any);
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
    jest.restoreAllMocks();
  });
  async function authorize(selectedFileId = fileId) {
    const { authorizationUrl } = await service.start(actor, {
      sourceUrl: `https://docs.google.com/document/d/${selectedFileId}/edit`,
    });
    const state = new URL(authorizationUrl).searchParams.get('state');
    const body = { state, code: 'synthetic-code', pickedFileIds: selectedFileId };
    const { documentId } = await service.complete(actor, body);
    return { documentId, body };
  }
  it('keeps auth actor bound, scrubs PKCE, and replays completion without exchanging again', async () => {
    const start = await service.start(actor, { sourceUrl });
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    const body = { state, code: 'code', pickedFileIds: fileId };
    await expect(service.complete({ id: 2, authVersion: 0 }, body)).rejects.toThrow();
    await expect(
      service.complete(actor, { ...body, pickedFileIds: 'different_file' }),
    ).rejects.toThrow();
    const first = await service.complete(actor, body);
    expect(await service.complete(actor, body)).toEqual(first);
    expect(provider.exchange).toHaveBeenCalledTimes(1);
    expect(
      (await db.manager.findOneByOrFail(DocumentAuthorization, { id: hashState(state) })).verifier,
    ).toBe('');
    const document = await db.manager.findOneByOrFail(DocumentConnection, { id: first.documentId });
    expect(document.credentials).not.toContain(credentials.accessToken);
    expect((await service.list(actor)).documents[0]).not.toHaveProperty('credentials');
  });
  it('enforces private current owner/org and returns an empty no-membership list', async () => {
    const { documentId } = await authorize();
    await expect(service.read({ id: 2, authVersion: 0 }, documentId)).rejects.toThrow();
    await db.manager.delete(EnterpriseMembership, { userId: 1 });
    expect(await service.list(actor)).toEqual({
      configured: true,
      organizationId: null,
      documents: [],
    });
    await expect(service.disconnect(actor, documentId, {})).rejects.toThrow();
    await expect(service.list({ id: 1, authVersion: 9 })).rejects.toThrow();
  });
  it('atomically stores versions, rejects changed request bodies and replays lost responses', async () => {
    const { documentId } = await authorize();
    const body = { requestId: randomUUID(), expectedVersion: 0 };
    const first = await service.refresh(actor, documentId, body);
    expect(first).toEqual({ documentId, version: 1, unchanged: false });
    expect(await service.refresh(actor, documentId, body)).toEqual(first);
    expect(await service.request(actor, documentId, body.requestId)).toEqual({
      status: 'completed',
      result: first,
    });
    await expect(
      service.refresh(actor, documentId, { ...body, expectedVersion: 1 }),
    ).rejects.toThrow();
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    expect(
      await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 1 }),
    ).toEqual({ documentId, version: 1, unchanged: true });
    expect(await db.manager.count(DocumentVersion)).toBe(1);
    expect(await service.read(actor, documentId, 1)).toMatchObject({
      markdown: captured().markdown,
      sha256: captured().sha256,
    });
  });
  it('preserves prior versions after provider failure and disconnects once', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    jest.mocked(provider.snapshot).mockRejectedValueOnce(new Error('provider unavailable'));
    const requestId = randomUUID();
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 1 }),
    ).rejects.toThrow();
    expect(await service.request(actor, documentId, requestId)).toEqual({ status: 'failed' });
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 1 }),
    ).rejects.toThrow();
    await service.disconnect(actor, documentId, {});
    const disconnected = await db.manager.findOneByOrFail(DocumentConnection, { id: documentId });
    await service.disconnect(actor, documentId, {});
    expect(
      (await db.manager.findOneByOrFail(DocumentConnection, { id: documentId })).generation,
    ).toBe(disconnected.generation);
    expect(disconnected.credentials).toBe('');
    expect(await service.read(actor, documentId)).toMatchObject({
      connected: false,
      snapshot: { markdown: captured().markdown },
      copyNotice: expect.stringContaining('Independent'),
    });
  });
  it('fences an epoch change during provider I/O without losing prior content', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    jest.mocked(provider.snapshot).mockImplementationOnce(async () => {
      await db.manager.update(User, { id: actor.id }, { authVersion: 1 });
      return captured('new text');
    });
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 1 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(1);
    expect(await service.read({ ...actor, authVersion: 1 }, documentId, 1)).toMatchObject({
      markdown: captured().markdown,
    });
  });
  it('fences disconnect during await and exposes no partial version', async () => {
    const { documentId } = await authorize();
    jest.mocked(provider.snapshot).mockImplementationOnce(async () => {
      await service.disconnect(actor, documentId, {});
      return captured();
    });
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(0);
    expect(await db.manager.count(DocumentChunk)).toBe(0);
  });
  it('reassembles the full 2MiB with bounded Unicode chunks and rejects overflow', async () => {
    const { documentId } = await authorize();
    const text = '🥔'.repeat(524288);
    jest.mocked(provider.snapshot).mockResolvedValueOnce(captured(text));
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    expect(await service.read(actor, documentId, 1)).toMatchObject({
      markdown: text,
      byteSize: 2097152,
    });
    for (const chunk of await db.manager.find(DocumentChunk)) {
      expect(Array.from(chunk.content).length).toBeLessThanOrEqual(8000);
      expect(Buffer.byteLength(chunk.content)).toBeLessThanOrEqual(32000);
    }
    jest.mocked(provider.snapshot).mockResolvedValueOnce(captured(text + 'x'));
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 1 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(1);
  });
  it('requires fresh consent after a claimed code and fences epoch change during exchange', async () => {
    const start = await service.start(actor, { sourceUrl });
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    jest.mocked(provider.exchange).mockImplementationOnce(async () => {
      await db.manager.update(User, { id: actor.id }, { authVersion: 1 });
      return credentials;
    });
    const body = { state, code: 'code', pickedFileIds: fileId };
    await expect(service.complete(actor, body)).rejects.toThrow();
    expect(await db.manager.count(DocumentConnection)).toBe(0);
    expect(
      (await db.manager.findOneByOrFail(DocumentAuthorization, { id: hashState(state) })).verifier,
    ).toBe('');
    await expect(service.complete({ ...actor, authVersion: 1 }, body)).rejects.toThrow();
  });
  it('rejects plaintext and wrong purpose/document/owner/org/generation envelopes', () => {
    const encrypted = seal(credentials, 'credentials/doc1/owner1/org1/generation1');
    expect(unseal(encrypted, 'credentials/doc1/owner1/org1/generation1')).toEqual(credentials);
    expect(() =>
      unseal(JSON.stringify(credentials), 'credentials/doc1/owner1/org1/generation1'),
    ).toThrow();
    for (const binding of [
      'pkce/doc1/owner1/org1/generation1',
      'credentials/doc2/owner1/org1/generation1',
      'credentials/doc1/owner2/org1/generation1',
      'credentials/doc1/owner1/org2/generation1',
      'credentials/doc1/owner1/org1/generation2',
    ])
      expect(() => unseal(encrypted, binding)).toThrow();
  });
  it('runs the migration twice on SQLite and enforces owner and attempt FKs', async () => {
    const runner = db.createQueryRunner();
    for (const entity of [...DOCUMENT_ENTITIES].reverse())
      await runner.dropTable(db.getMetadata(entity).tableName, true, true, true);
    const migration = new AddDocumentConnections1793232000000();
    await migration.up(runner);
    await migration.up(runner);
    const { documentId } = await authorize();
    expect(await service.read(actor, documentId)).toMatchObject({
      currentVersion: 0,
      snapshot: null,
    });
    await expect(db.manager.delete(User, { id: 1 })).rejects.toThrow();
    const attemptTable = await runner.getTable('document_authorization');
    expect(attemptTable.foreignKeys.map(key => key.referencedTableName).sort()).toEqual([
      'enterprise_organization',
      'user',
    ]);
    await runner.release();
  });
  it('rolls back content/current version together when a real database write fails', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    await db.query(
      "CREATE TRIGGER reject_document_chunk BEFORE INSERT ON document_chunk BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END",
    );
    jest.mocked(provider.snapshot).mockResolvedValueOnce(captured('changed'));
    const requestId = randomUUID();
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 1 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(1);
    expect(await service.read(actor, documentId)).toMatchObject({
      currentVersion: 1,
      snapshot: { markdown: captured().markdown },
    });
    expect(await service.request(actor, documentId, requestId)).toEqual({ status: 'failed' });
  });
  it('allows explicit abandoned pre-observation retry and fences the old worker token', async () => {
    const { documentId } = await authorize();
    const requestId = randomUUID();
    jest.mocked(provider.renew).mockImplementationOnce(async () => {
      await db.manager.update(
        DocumentRefresh,
        { documentId, requestId },
        { leaseUntil: '2000-01-01T00:00:00.000Z' },
      );
      expect(await service.refresh(actor, documentId, { requestId, expectedVersion: 0 })).toEqual({
        documentId,
        version: 1,
        unchanged: false,
      });
      return credentials;
    });
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await service.request(actor, documentId, requestId)).toMatchObject({
      status: 'completed',
      result: { version: 1 },
    });
    expect(await db.manager.count(DocumentVersion)).toBe(1);
  });
  it('requires a new request after an observed worker is abandoned', async () => {
    const { documentId } = await authorize();
    const requestId = randomUUID();
    jest.mocked(provider.snapshot).mockImplementationOnce(async () => {
      await db.manager.update(
        DocumentRefresh,
        { documentId, requestId },
        { leaseUntil: '2000-01-01T00:00:00.000Z' },
      );
      await expect(
        service.refresh(actor, documentId, { requestId, expectedVersion: 0 }),
      ).rejects.toThrow('abandoned');
      return captured();
    });
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await service.request(actor, documentId, requestId)).toEqual({ status: 'failed' });
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
    expect(await db.manager.count(DocumentVersion)).toBe(0);
  });
  it('rejects concurrent current-version CAS losers', async () => {
    const { documentId } = await authorize();
    const requestId = randomUUID();
    jest.mocked(provider.snapshot).mockImplementationOnce(async () => {
      await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
      return captured('losing snapshot');
    });
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(1);
    expect(await service.read(actor, documentId, 1)).toMatchObject({
      markdown: captured().markdown,
    });
  });
  it('pins reconnects and rejects new grants missing a refresh token without credential reuse', async () => {
    const { documentId } = await authorize();
    await expect(
      service.start(actor, {
        documentId,
        sourceUrl: 'https://docs.google.com/document/d/differentfile123/edit',
      }),
    ).rejects.toThrow();
    const start = await service.start(actor, { documentId, sourceUrl });
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    jest
      .mocked(provider.exchange)
      .mockResolvedValueOnce({ accessToken: 'new-access', expiresAt: Date.now() + 60000 });
    await expect(
      service.complete(actor, { state, code: 'new-code', pickedFileIds: fileId }),
    ).rejects.toThrow();
    expect(
      (await db.manager.findOneByOrFail(DocumentConnection, { id: documentId })).generation,
    ).toBe(1);
    expect(await db.manager.count(DocumentVersion)).toBe(0);
  });
  it('enforces the document, version and total byte ceilings without deleting history', async () => {
    const { documentId } = await authorize();
    for (let version = 0; version < 50; version++) {
      jest.mocked(provider.snapshot).mockResolvedValueOnce(captured(`version ${version}`));
      await service.refresh(actor, documentId, {
        requestId: randomUUID(),
        expectedVersion: version,
      });
    }
    jest.mocked(provider.snapshot).mockResolvedValueOnce(captured('version 51'));
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 50 }),
    ).rejects.toThrow('Version limit');
    expect(await db.manager.count(DocumentVersion)).toBe(50);
    for (let i = 1; i < 20; i++) await authorize(`unique-document-${i}`);
    await expect(service.start(actor, { sourceUrl })).rejects.toThrow('Document limit');
    expect((await service.list(actor)).documents).toHaveLength(20);
  });
  it('enforces 20MiB total snapshot bytes on actual stored content', async () => {
    const { documentId } = await authorize();
    const text = 'a'.repeat(2097151);
    for (let version = 0; version < 10; version++) {
      jest.mocked(provider.snapshot).mockResolvedValueOnce(captured(text + version));
      await service.refresh(actor, documentId, {
        requestId: randomUUID(),
        expectedVersion: version,
      });
    }
    jest.mocked(provider.snapshot).mockResolvedValueOnce(captured('overflow'));
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 10 }),
    ).rejects.toThrow('Stored snapshot limit');
    expect(await db.manager.count(DocumentVersion)).toBe(10);
    expect(await service.read(actor, documentId, 1)).toMatchObject({ markdown: text + '0' });
  });
  it('expires consent in ten minutes and scrubs the encrypted verifier on expiry', async () => {
    const start = await service.start(actor, { sourceUrl });
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    const attempt = await db.manager.findOneByOrFail(DocumentAuthorization, {
      id: hashState(state),
    });
    expect(new Date(attempt.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600000);
    await db.manager.update(
      DocumentAuthorization,
      { id: hashState(state) },
      { expiresAt: '2000-01-01T00:00:00.000Z' },
    );
    await expect(
      service.complete(actor, { state, code: 'expired', pickedFileIds: fileId }),
    ).rejects.toThrow();
    expect(
      (await db.manager.findOneByOrFail(DocumentAuthorization, { id: hashState(state) })).verifier,
    ).toBe('');
    expect(provider.exchange).not.toHaveBeenCalled();
  });
  it('stores only hashed OAuth state and prevents duplicate owner/org/file connections', async () => {
    const first = await service.start(actor, { sourceUrl });
    const second = await service.start(actor, { sourceUrl });
    const firstState = new URL(first.authorizationUrl).searchParams.get('state');
    const secondState = new URL(second.authorizationUrl).searchParams.get('state');
    expect(await db.manager.findOneBy(DocumentAuthorization, { id: firstState })).toBeNull();
    expect(
      await db.manager.findOneBy(DocumentAuthorization, { id: hashState(firstState) }),
    ).not.toBeNull();
    const { documentId } = await service.complete(actor, {
      state: firstState,
      code: 'first',
      pickedFileIds: fileId,
    });
    await expect(
      service.complete(actor, { state: secondState, code: 'second', pickedFileIds: fileId }),
    ).rejects.toThrow('already connected');
    await expect(service.start(actor, { sourceUrl })).rejects.toThrow('already connected');
    const document = await db.manager.findOneByOrFail(DocumentConnection, { id: documentId });
    await expect(
      db.manager.insert(DocumentConnection, { ...document, id: randomUUID() }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentConnection)).toBe(1);
  });
  it('requires new consent after epoch changes while preserving independent copies', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    await db.manager.update(User, { id: 1 }, { authVersion: 1 });
    const currentActor = { ...actor, authVersion: 1 };
    expect((await service.list(currentActor)).documents[0].connected).toBe(false);
    await expect(
      service.refresh(currentActor, documentId, { requestId: randomUUID(), expectedVersion: 1 }),
    ).rejects.toThrow('Reconnect');
    expect(provider.renew).toHaveBeenCalledTimes(1);
    expect(await service.read(currentActor, documentId, 1)).toMatchObject({
      markdown: captured().markdown,
    });
    const start = await service.start(currentActor, { sourceUrl, documentId });
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    await service.complete(currentActor, { state, code: 'fresh-code', pickedFileIds: fileId });
    expect(
      (await db.manager.findOneByOrFail(DocumentConnection, { id: documentId })).credentialEpoch,
    ).toBe(1);
    expect(
      await service.refresh(currentActor, documentId, {
        requestId: randomUUID(),
        expectedVersion: 1,
      }),
    ).toEqual({ documentId, version: 1, unchanged: true });
  });
  it('pins fixed organization during provider I/O', async () => {
    const { documentId } = await authorize();
    await db.manager.insert(EnterpriseOrganization, { id: 2, name: 'Other org', version: 1 });
    jest.mocked(provider.snapshot).mockImplementationOnce(async () => {
      await db.manager.update(EnterpriseMembership, { userId: 1 }, { organizationId: 2 });
      return captured();
    });
    await expect(
      service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await db.manager.count(DocumentVersion)).toBe(0);
    expect((await service.list(actor)).documents).toEqual([]);
  });
  it('bounds active consent to ten attempts and total retained consent to one hundred', async () => {
    for (let index = 0; index < 10; index++) await service.start(actor, { sourceUrl });
    await expect(service.start(actor, { sourceUrl })).rejects.toThrow('attempt limit');
    for (let batch = 0; batch < 9; batch++) {
      await db.manager.update(
        DocumentAuthorization,
        { ownerId: 1 },
        { expiresAt: '2000-01-01T00:00:00.000Z' },
      );
      for (let index = 0; index < 10; index++) await service.start(actor, { sourceUrl });
    }
    await db.manager.update(
      DocumentAuthorization,
      { ownerId: 1 },
      { expiresAt: '2000-01-01T00:00:00.000Z' },
    );
    await expect(service.start(actor, { sourceUrl })).rejects.toThrow('attempt limit');
    expect(await db.manager.count(DocumentAuthorization)).toBe(100);
  });
  it('GET calls neither fetch nor retry and leave stored receipt states untouched', async () => {
    const { documentId } = await authorize();
    const requestId = randomUUID();
    const document = await db.manager.findOneByOrFail(DocumentConnection, { id: documentId });
    await db.manager.insert(DocumentRefresh, {
      documentId,
      requestId,
      expectedVersion: 0,
      generation: document.generation,
      epoch: 0,
      status: 'running',
      token: randomUUID(),
      leaseUntil: '2000-01-01T00:00:00.000Z',
      result: 'observation-started',
    });
    const before = await db.manager.findOneByOrFail(DocumentRefresh, { documentId, requestId });
    expect(await service.request(actor, documentId, requestId)).toEqual({ status: 'running' });
    expect(await service.request(actor, documentId, randomUUID())).toEqual({ status: 'missing' });
    await service.list(actor);
    await service.read(actor, documentId);
    expect(await db.manager.findOneByOrFail(DocumentRefresh, { documentId, requestId })).toEqual(
      before,
    );
    expect(provider.renew).not.toHaveBeenCalled();
    expect(provider.snapshot).not.toHaveBeenCalled();
  });
  it('records terminal stale-version rejection so another tab can explicitly recover', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    const requestId = randomUUID();
    await expect(
      service.refresh(actor, documentId, { requestId, expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await service.request(actor, documentId, requestId)).toEqual({ status: 'failed' });
    expect(await db.manager.count(DocumentVersion)).toBe(1);
    expect(provider.snapshot).toHaveBeenCalledTimes(1);
  });
  it('refuses an AI summary without cost consent and never calls the model', async () => {
    const { documentId } = await authorize();
    const generate = (service as unknown as { ai: { generate: jest.Mock } }).ai.generate;
    await expect(service.aiSummary(actor, documentId, {})).rejects.toThrow('호출 비용');
    await expect(service.aiSummary(actor, documentId, { confirmAiCost: false })).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
    expect(await db.manager.count(DocumentSummary, { where: { documentId } })).toBe(0);
  });
  it('stores one summary per version and reuses it until the stored copy changes', async () => {
    const { documentId } = await authorize();
    await service.refresh(actor, documentId, { requestId: randomUUID(), expectedVersion: 0 });
    const generate = (service as unknown as { ai: { generate: jest.Mock } }).ai.generate;
    generate.mockResolvedValue('  문서 요약  ');
    const first = await service.aiSummary(actor, documentId, { confirmAiCost: true });
    expect(first).toMatchObject({ documentId, version: 1, summary: '문서 요약', cached: false });
    const second = await service.aiSummary(actor, documentId, { confirmAiCost: true });
    expect(second.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    const rows = await db.manager.find(DocumentSummary, { where: { documentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceSha256).toBe(captured().sha256);
    await expect(
      service.aiSummary(actor, documentId, { confirmAiCost: true, version: 9 }),
    ).rejects.toThrow();
  });

  it('shares with an organization member, lets them read, and stops access after revoke', async () => {
    const { documentId } = await authorize();
    const member = { id: 2, authVersion: 0 };
    await expect(service.read(member, documentId)).rejects.toThrow();
    await expect(
      service.share(actor, documentId, { recipientId: 2, active: true }),
    ).resolves.toMatchObject({
      documentId,
      recipientId: 2,
      active: true,
    });
    const shared = (await service.read(member, documentId)) as { role?: string; id: string };
    expect(shared.role).toBe('recipient');
    expect(shared.id).toBe(documentId);
    expect(((await service.read(actor, documentId)) as { role?: string }).role).toBe('owner');
    await expect(
      service.refresh(member, documentId, { requestId: randomUUID(), expectedVersion: 0 }),
    ).rejects.toThrow();
    expect(await service.shares(actor, documentId)).toHaveLength(1);
    await service.share(actor, documentId, { recipientId: 2, active: false });
    await expect(service.read(member, documentId)).rejects.toThrow();
    expect(((await service.read(actor, documentId)) as { id: string }).id).toBe(documentId);
  });
  it('rejects sharing with a user outside the organization or with the owner', async () => {
    const { documentId } = await authorize();
    await expect(
      service.share(actor, documentId, { recipientId: 1, active: true }),
    ).rejects.toThrow();
    await expect(
      service.share(actor, documentId, { recipientId: 99, active: true }),
    ).rejects.toThrow();
  });

  it('lists shared documents for the recipient and drops them after revoke', async () => {
    const { documentId } = await authorize();
    const member = { id: 2, authVersion: 0 };
    expect((await service.list(member)).documents).toHaveLength(0);
    await service.share(actor, documentId, { recipientId: 2, active: true });
    const listed = (await service.list(member)).documents as Array<{ id: string; role?: string }>;
    expect(listed.map(item => item.id)).toContain(documentId);
    expect(listed.find(item => item.id === documentId)?.role).toBe('recipient');
    expect(((await service.list(actor)).documents as Array<{ role?: string }>)[0].role).toBe('owner');
    await service.share(actor, documentId, { recipientId: 2, active: false });
    expect((await service.list(member)).documents).toHaveLength(0);
  });
});
