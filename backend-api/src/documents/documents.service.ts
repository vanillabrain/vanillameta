import {
  BadRequestException,
  Inject,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { z } from 'zod';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import {
  DocumentAuthorization,
  DocumentChunk,
  DocumentConnection,
  DocumentRefresh,
  DocumentVersion,
} from './document.entity';
import {
  DOCUMENT_MAX_BYTES,
  GoogleDocsProvider,
  googleCredentialsSchema,
  googleDocumentId,
} from './google-docs.provider';
import { seal, unseal } from './document-crypto';
import { DocumentSummary } from './document-summary.entity';
import { DOCUMENT_SUMMARY_AI, DocumentSummaryAi } from './document-ai';
import { summarizeDocument } from './document-summary';

export const documentActorSchema = z.object({
  id: z.number().int().positive(),
  authVersion: z.number().int().nonnegative().default(0),
});
export type DocumentActor = z.infer<typeof documentActorSchema>;
const uuid = z.string().uuid();
const resultSchema = z.object({
  documentId: uuid,
  version: z.number().int().nonnegative(),
  unchanged: z.boolean(),
});
const now = () => new Date().toISOString();
const stateHash = (state: string) => createHash('sha256').update(state).digest('hex');
function credentialsFrom(value: unknown) {
  const result = googleCredentialsSchema.safeParse(value);
  if (!result.success)
    throw new BadGatewayException('Google document authorization requires fresh consent.');
  return result.data;
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid document request.');
  return result.data;
}
function binding(
  document: Pick<DocumentConnection, 'id' | 'ownerId' | 'organizationId' | 'generation'>,
  purpose: string,
) {
  return JSON.stringify([
    purpose,
    document.id,
    document.ownerId,
    document.organizationId,
    document.generation,
  ]);
}
function summary(document: DocumentConnection, epoch: number) {
  return {
    id: document.id,
    title: document.title,
    provider: document.provider ?? 'google',
    sourceUrl:
      (document.provider ?? 'google') === 'microsoft'
        ? `https://onedrive.live.com/?id=${document.fileId}`
        : `https://docs.google.com/document/d/${document.fileId}/edit`,
    currentVersion: document.currentVersion,
    connected: document.connected && document.credentialEpoch === epoch,
    updatedAt: document.updatedAt,
  };
}
function versionInfo(value: DocumentVersion) {
  return {
    version: value.version,
    sourceVersion: value.sourceVersion,
    sourceModifiedAt: value.sourceModifiedAt,
    capturedAt: value.capturedAt,
    sha256: value.sha256,
    byteSize: value.byteSize,
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DataSource,
    private readonly provider: GoogleDocsProvider,
    @Inject(DOCUMENT_SUMMARY_AI) private readonly ai: DocumentSummaryAi,
  ) {}
  private transaction<T>(
    actor: DocumentActor,
    operation: (manager: EntityManager, organizationId: number | null) => Promise<T>,
  ) {
    return sourceWriteTransaction(this.db, async manager => {
      await lockSourceActor(manager, actor.id, actor.authVersion);
      const membership = await manager.findOneBy(EnterpriseMembership, { userId: actor.id });
      const organization =
        membership &&
        (await manager.findOneBy(EnterpriseOrganization, { id: membership.organizationId }));
      return operation(manager, organization?.id ?? null);
    });
  }
  private requireOrg(organizationId: number | null): number {
    if (!organizationId) throw new ForbiddenException('Current organization membership required.');
    return organizationId;
  }
  private async document(
    manager: EntityManager,
    actor: DocumentActor,
    organizationId: number | null,
    id: string,
  ) {
    const document = await manager.findOneBy(DocumentConnection, {
      id: parse(uuid, id),
      ownerId: actor.id,
      organizationId: this.requireOrg(organizationId),
    });
    if (!document) throw new NotFoundException('Document not found.');
    return document;
  }
  googleConfigured() {
    return this.provider.configured();
  }
  async list(actor: DocumentActor) {
    return this.transaction(actor, async (manager, organizationId) => ({
      configured: !!process.env.CONFIG_SECRET_KEY && this.provider.configured(),
      organizationId,
      documents: organizationId
        ? (
            await manager.find(DocumentConnection, {
              where: { ownerId: actor.id, organizationId },
              order: { updatedAt: 'DESC' },
            })
          ).map(document => summary(document, actor.authVersion))
        : [],
    }));
  }
  private async snapshot(manager: EntityManager, document: DocumentConnection, version: number) {
    const info = await manager.findOneBy(DocumentVersion, { documentId: document.id, version });
    if (!info) throw new NotFoundException('Version not found.');
    const chunks = await manager.find(DocumentChunk, {
      where: { documentId: document.id, version },
      order: { position: 'ASC' },
    });
    const markdown = chunks
      .map((chunk, position) => {
        if (chunk.position !== position || Array.from(chunk.content).length > 8000)
          throw new ConflictException('Stored document is incomplete.');
        return chunk.content;
      })
      .join('');
    if (
      Buffer.byteLength(markdown) !== info.byteSize ||
      createHash('sha256').update(markdown).digest('hex') !== info.sha256
    )
      throw new ConflictException('Stored document integrity check failed.');
    return { ...versionInfo(info), markdown };
  }
  async read(actor: DocumentActor, id: string, version?: number) {
    return this.transaction(actor, async (manager, org) => {
      const document = await this.document(manager, actor, org, id);
      if (version !== undefined)
        return this.snapshot(manager, document, parse(z.number().int().positive(), version));
      const versions = await manager.find(DocumentVersion, {
        where: { documentId: id },
        order: { version: 'DESC' },
      });
      return {
        ...summary(document, actor.authVersion),
        versions: versions.map(versionInfo),
        snapshot: document.currentVersion
          ? await this.snapshot(manager, document, document.currentVersion)
          : null,
        copyNotice: 'Independent stored copy. Disconnecting preserves saved versions.',
      };
    });
  }
  async aiSummary(actor: DocumentActor, rawId: string, input: unknown) {
    const body = z
      .object({
        confirmAiCost: z.boolean().optional(),
        version: z.number().int().positive().optional(),
      })
      .strict()
      .parse(input ?? {});
    if (body.confirmAiCost !== true)
      throw new BadRequestException({
        code: 'SUMMARY_CONSENT_REQUIRED',
        message: 'AI 요약은 호출 비용이 발생합니다. 동의한 뒤 다시 요청해 주세요.',
      });
    const id = parse(uuid, rawId);
    const head = await this.transaction(actor, async (manager, org) => {
      const document = await this.document(manager, actor, org, id);
      const version = body.version ?? document.currentVersion;
      if (!version)
        throw new ConflictException('저장된 문서 버전이 없습니다. 먼저 새로고침하세요.');
      const snapshot = await this.snapshot(manager, document, version);
      const cached = await manager.findOne(DocumentSummary, { where: { documentId: id, version } });
      return { document, version, snapshot, org, cached };
    });
    if (head.cached && head.cached.sourceSha256 === head.snapshot.sha256)
      return {
        documentId: id,
        version: head.version,
        summary: head.cached.summary,
        generatedAt: head.cached.generatedAt,
        cached: true,
      };
    const generated = await summarizeDocument({
      confirmAiCost: true,
      title: head.document.title,
      markdown: head.snapshot.markdown,
      generate: prompt =>
        this.ai.generate({
          system:
            '당신은 업무 문서 요약가입니다. 주어진 문서만 근거로 한국어로 간결하게 요약하세요.',
          prompt,
          caller: { userId: actor.id, epoch: actor.authVersion, feature: 'document-summary' },
        }),
    });
    const generatedAt = now();
    await this.transaction(actor, async (manager, org) => {
      const existing = await manager.findOne(DocumentSummary, {
        where: { documentId: id, version: head.version },
      });
      if (existing)
        await manager.update(
          DocumentSummary,
          { documentId: id, version: head.version },
          { sourceSha256: head.snapshot.sha256, summary: generated.summary, generatedAt },
        );
      else
        await manager.insert(DocumentSummary, {
          documentId: id,
          version: head.version,
          ownerId: actor.id,
          organizationId: org ?? 0,
          sourceSha256: head.snapshot.sha256,
          summary: generated.summary,
          generatedAt,
        });
    });
    return {
      documentId: id,
      version: head.version,
      summary: generated.summary,
      generatedAt,
      cached: false,
    };
  }
  async start(actor: DocumentActor, body: unknown) {
    const input = parse(
      z.object({ sourceUrl: z.string().max(2048), documentId: uuid.optional() }).strict(),
      body,
    );
    const fileId = googleDocumentId(input.sourceUrl);
    if (!this.provider.configured() || !process.env.CONFIG_SECRET_KEY)
      throw new ServiceUnavailableException('Google document connection is not configured.');
    return this.transaction(actor, async (manager, org) => {
      const organizationId = this.requireOrg(org);
      const existing = input.documentId
        ? await this.document(manager, actor, org, input.documentId)
        : null;
      if (existing && existing.fileId !== fileId)
        throw new ConflictException('Reconnect must use the same file.');
      if (
        !existing &&
        (await manager.countBy(DocumentConnection, { ownerId: actor.id, organizationId })) >= 20
      )
        throw new ConflictException('Document limit reached.');
      if (
        !existing &&
        (await manager.countBy(DocumentConnection, { ownerId: actor.id, organizationId, fileId }))
      )
        throw new ConflictException('Document already connected. Reconnect the existing document.');
      const authorizations = await manager.countBy(DocumentAuthorization, { ownerId: actor.id });
      const active = await manager.count(DocumentAuthorization, {
        where: [
          { ownerId: actor.id, status: 'pending', expiresAt: MoreThan(now()) },
          { ownerId: actor.id, status: 'claimed', expiresAt: MoreThan(now()) },
        ],
      });
      if (authorizations >= 100 || active >= 10)
        throw new ConflictException('Authorization attempt limit reached.');
      const id = existing?.id ?? randomUUID();
      const generation = existing?.generation ?? 0;
      const state = randomBytes(32).toString('hex');
      const hash = stateHash(state);
      const verifier = randomBytes(48).toString('base64url');
      const authorizationUrl = this.provider.authorizationUrl({ state, verifier, fileId });
      await manager.insert(DocumentAuthorization, {
        id: hash,
        documentId: id,
        ownerId: actor.id,
        organizationId,
        epoch: actor.authVersion,
        generation,
        fileId,
        status: 'pending',
        verifier: seal(
          verifier,
          binding({ id, ownerId: actor.id, organizationId, generation }, `pkce:${hash}`),
        ),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });
      return { authorizationUrl };
    });
  }
  async complete(actor: DocumentActor, body: unknown) {
    const input = parse(
      z
        .object({
          state: z.string().regex(/^[a-f0-9]{64}$/),
          code: z.string().min(1).max(8192),
          pickedFileIds: z.string().min(1).max(200),
        })
        .strict(),
      body,
    );
    const hashedState = stateHash(input.state);
    const attempt = await this.transaction(actor, async (manager, org) => {
      const attempt = await manager.findOneBy(DocumentAuthorization, {
        id: hashedState,
        ownerId: actor.id,
        organizationId: this.requireOrg(org),
        epoch: actor.authVersion,
      });
      if (!attempt || attempt.fileId !== input.pickedFileIds)
        throw new ForbiddenException('Invalid authorization state or selected file.');
      if (attempt.status === 'completed') return { kind: 'completed' as const, attempt };
      if (attempt.status !== 'pending' || attempt.expiresAt <= now()) {
        attempt.verifier = '';
        attempt.status = 'failed';
        await manager.save(attempt);
        return { kind: 'failed' as const, attempt };
      }
      const verifier = parse(
        z.string().min(1),
        unseal(
          attempt.verifier,
          binding(
            {
              id: attempt.documentId,
              ownerId: attempt.ownerId,
              organizationId: attempt.organizationId,
              generation: attempt.generation,
            },
            `pkce:${attempt.id}`,
          ),
        ),
      );
      attempt.status = 'claimed';
      attempt.verifier = '';
      await manager.save(attempt);
      return { kind: 'claimed' as const, attempt, verifier };
    });
    if (attempt.kind === 'completed') return { documentId: attempt.attempt.documentId };
    if (attempt.kind === 'failed') throw new ConflictException('Fresh consent required.');
    try {
      const credentials = credentialsFrom(
        await this.provider.exchange({ code: input.code, verifier: attempt.verifier }),
      );
      await this.transaction(actor, async (_manager, org) => {
        if (org !== attempt.attempt.organizationId) throw new ForbiddenException();
      });
      const metadata = await this.provider.metadata(attempt.attempt.fileId, credentials);
      if (metadata.id !== attempt.attempt.fileId)
        throw new ForbiddenException('Selected document changed.');
      return await this.transaction(actor, async (manager, org) => {
        const a = attempt.attempt;
        if (org !== a.organizationId) throw new ForbiddenException();
        const stored = await manager.findOneByOrFail(DocumentAuthorization, { id: a.id });
        if (stored.status !== 'claimed' || stored.expiresAt <= now())
          throw new ConflictException('Fresh consent required.');
        let document = await manager.findOneBy(DocumentConnection, { id: a.documentId });
        if (
          document &&
          (document.ownerId !== actor.id ||
            document.organizationId !== org ||
            document.generation !== a.generation)
        )
          throw new ConflictException('Connection changed.');
        if (!document) {
          if (
            await manager.countBy(DocumentConnection, {
              ownerId: actor.id,
              organizationId: org,
              fileId: a.fileId,
            })
          )
            throw new ConflictException(
              'Document already connected. Reconnect the existing document.',
            );
          if (
            (await manager.countBy(DocumentConnection, {
              ownerId: actor.id,
              organizationId: org,
            })) >= 20
          )
            throw new ConflictException('Document limit reached.');
          document = manager.create(DocumentConnection, {
            id: a.documentId,
            ownerId: actor.id,
            organizationId: org,
            fileId: a.fileId,
            currentVersion: 0,
            generation: 0,
          });
        }
        document.generation++;
        document.credentialEpoch = actor.authVersion;
        document.connected = true;
        document.title = metadata.name;
        document.updatedAt = now();
        document.credentials = seal(credentials, binding(document, 'google-credentials'));
        await manager.save(document);
        stored.status = 'completed';
        await manager.save(stored);
        return { documentId: document.id };
      });
    } catch (error) {
      await sourceWriteTransaction(this.db, async manager => {
        await manager.update(
          DocumentAuthorization,
          { id: hashedState, status: 'claimed' },
          { status: 'failed', verifier: '' },
        );
      });
      throw error;
    }
  }
  async disconnect(actor: DocumentActor, id: string, body: unknown) {
    parse(z.object({}).strict(), body);
    return this.transaction(actor, async (manager, org) => {
      const document = await this.document(manager, actor, org, id);
      if (document.connected) {
        document.connected = false;
        document.credentials = '';
        document.generation++;
        document.updatedAt = now();
        await manager.save(document);
      }
      return { disconnected: true as const };
    });
  }
  async request(actor: DocumentActor, id: string, requestId: string) {
    parse(uuid, requestId);
    return this.transaction(actor, async (manager, org) => {
      await this.document(manager, actor, org, id);
      const request = await manager.findOneBy(DocumentRefresh, { documentId: id, requestId });
      if (!request) return { status: 'missing' as const };
      return request.status === 'completed'
        ? { status: 'completed' as const, result: resultSchema.parse(JSON.parse(request.result)) }
        : { status: request.status };
    });
  }
  async refresh(actor: DocumentActor, id: string, body: unknown) {
    const input = parse(
      z.object({ requestId: uuid, expectedVersion: z.number().int().min(0).max(50) }).strict(),
      body,
    );
    const prepared = await this.transaction(actor, async (manager, org) => {
      const document = await this.document(manager, actor, org, id);
      let request = await manager.findOneBy(DocumentRefresh, {
        documentId: id,
        requestId: input.requestId,
      });
      if (request && request.expectedVersion !== input.expectedVersion)
        throw new ConflictException('Request body changed.');
      if (request?.status === 'completed')
        return {
          kind: 'completed' as const,
          result: resultSchema.parse(JSON.parse(request.result)),
        };
      if (request?.status === 'failed') throw new ConflictException('Use a new explicit request.');
      if (request && request.leaseUntil > now()) throw new ConflictException('Refresh is running.');
      if (request?.result === 'observation-started') {
        await manager.update(
          DocumentRefresh,
          { documentId: id, requestId: input.requestId },
          { status: 'failed' },
        );
        return { kind: 'failed' as const };
      }
      if (!document.connected || document.currentVersion !== input.expectedVersion) {
        await manager.save(DocumentRefresh, {
          documentId: id,
          requestId: input.requestId,
          expectedVersion: input.expectedVersion,
          generation: document.generation,
          epoch: actor.authVersion,
          status: 'failed',
          token: request?.token ?? randomUUID(),
          leaseUntil: now(),
          result: '',
        });
        return { kind: 'failed' as const };
      }
      if (document.credentialEpoch !== actor.authVersion)
        throw new ForbiddenException('Reconnect this document for the current session.');
      const credentials = credentialsFrom(
        unseal(document.credentials, binding(document, 'google-credentials')),
      );
      if (
        request &&
        (request.generation !== document.generation || request.epoch !== actor.authVersion)
      )
        throw new ConflictException('Refresh authority changed.');
      request = manager.create(DocumentRefresh, {
        documentId: id,
        requestId: input.requestId,
        expectedVersion: input.expectedVersion,
        generation: document.generation,
        epoch: actor.authVersion,
        status: 'running',
        token: randomUUID(),
        leaseUntil: new Date(Date.now() + 120000).toISOString(),
        result: '',
      });
      await manager.save(request);
      return { kind: 'running' as const, document, credentials, request };
    });
    if (prepared.kind === 'completed') return prepared.result;
    if (prepared.kind === 'failed')
      throw new ConflictException('Review the current document before a new explicit request.');
    const { document, request } = prepared;
    const check = (manager: EntityManager, org: number | null) =>
      this.checkRefresh(manager, actor, org, document, request);
    try {
      const credentials = credentialsFrom(await this.provider.renew(prepared.credentials));
      await this.transaction(actor, async (manager, org) => {
        await check(manager, org);
        await manager.update(
          DocumentRefresh,
          { documentId: id, requestId: request.requestId, token: request.token },
          { result: 'observation-started' },
        );
      });
      // A crash after this point requires a new request so its observed target cannot change.
      const captured = await this.provider.snapshot(document.fileId, credentials);
      if (
        captured.metadata.id !== document.fileId ||
        captured.byteSize !== Buffer.byteLength(captured.markdown) ||
        captured.byteSize > DOCUMENT_MAX_BYTES ||
        captured.sha256 !== createHash('sha256').update(captured.markdown).digest('hex')
      )
        throw new ConflictException('Invalid document snapshot.');
      return await this.transaction(actor, async (manager, org) => {
        const current = await check(manager, org);
        const previous = current.currentVersion
          ? await manager.findOneByOrFail(DocumentVersion, {
              documentId: id,
              version: current.currentVersion,
            })
          : null;
        const unchanged =
          previous?.sha256 === captured.sha256 &&
          previous?.sourceVersion === captured.metadata.version &&
          previous?.sourceModifiedAt === captured.metadata.modifiedTime;
        const version = current.currentVersion + (unchanged ? 0 : 1);
        if (!unchanged) {
          if (version > 50) throw new ConflictException('Version limit reached.');
          const owned = await manager.find(DocumentConnection, {
            where: { ownerId: actor.id, organizationId: org },
          });
          let total = 0;
          for (const ownedDocument of owned)
            for (const info of await manager.findBy(DocumentVersion, {
              documentId: ownedDocument.id,
            }))
              total += info.byteSize;
          if (total + captured.byteSize > 20 * 1024 * 1024)
            throw new ConflictException('Stored snapshot limit reached.');
          await manager.insert(DocumentVersion, {
            documentId: id,
            version,
            sourceVersion: captured.metadata.version,
            sourceModifiedAt: captured.metadata.modifiedTime,
            capturedAt: now(),
            sha256: captured.sha256,
            byteSize: captured.byteSize,
          });
          const points = Array.from(captured.markdown);
          for (let start = 0; start < points.length; start += 8000)
            await manager.insert(DocumentChunk, {
              documentId: id,
              version,
              position: start / 8000,
              content: points.slice(start, start + 8000).join(''),
            });
        }
        current.currentVersion = version;
        current.title = captured.metadata.name;
        current.updatedAt = now();
        current.credentials = seal(credentials, binding(current, 'google-credentials'));
        await manager.save(current);
        const result = { documentId: id, version, unchanged: !!unchanged };
        await manager.update(
          DocumentRefresh,
          { documentId: id, requestId: request.requestId, token: request.token },
          { status: 'completed', result: JSON.stringify(result) },
        );
        return result;
      });
    } catch (error) {
      await sourceWriteTransaction(this.db, manager =>
        manager.update(
          DocumentRefresh,
          { documentId: id, requestId: request.requestId, token: request.token, status: 'running' },
          { status: 'failed' },
        ),
      );
      throw error;
    }
  }
  private async checkRefresh(
    manager: EntityManager,
    actor: DocumentActor,
    org: number | null,
    initial: DocumentConnection,
    request: DocumentRefresh,
  ) {
    const document = await this.document(manager, actor, org, initial.id);
    const current = await manager.findOneBy(DocumentRefresh, {
      documentId: initial.id,
      requestId: request.requestId,
    });
    if (
      !document.connected ||
      document.credentialEpoch !== actor.authVersion ||
      document.generation !== initial.generation ||
      document.currentVersion !== request.expectedVersion ||
      !current ||
      current.status !== 'running' ||
      current.token !== request.token ||
      current.leaseUntil <= now()
    )
      throw new ConflictException('Refresh authority or lease changed.');
    return document;
  }
}
