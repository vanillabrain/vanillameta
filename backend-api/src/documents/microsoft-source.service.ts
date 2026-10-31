import { ForbiddenException, Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { DocumentChunk, DocumentConnection, DocumentVersion } from './document.entity';
import { seal } from './document-crypto';
import { MicrosoftDocsProvider } from './microsoft-docs.provider';

const input = z
  .object({
    code: z.string().min(1).max(4096),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    itemId: z.string().min(1).max(400),
  })
  .strict();

const chunks = (markdown: string) => markdown.match(/[\s\S]{1,8000}/g) ?? [''];

@Injectable()
export class MicrosoftSourceService {
  constructor(private readonly provider: MicrosoftDocsProvider, private readonly db: DataSource) {}

  authorization(raw: string) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(raw))
      throw new BadRequestException('PKCE verifier가 올바르지 않습니다.');
    const state = randomBytes(16).toString('hex');
    return {
      authorizationUrl: this.provider.authorizationUrl({ state, verifier: raw, itemId: '' }),
      state,
    };
  }

  async preview(raw: unknown) {
    const body = input.parse(raw);
    const tokens = await this.provider.exchange(body.code, body.verifier);
    const item = await this.provider.item(tokens.accessToken, body.itemId);
    const markdown = await this.provider.text(tokens.accessToken, body.itemId);
    return { ...item, markdown };
  }

  async save(ownerId: number, raw: unknown) {
    const body = input.parse(raw);
    const membership = await this.db.manager.findOne(EnterpriseMembership, {
      where: { userId: ownerId },
    });
    if (!membership) throw new ForbiddenException('문서를 저장하려면 조직 소속이 필요합니다.');
    const tokens = await this.provider.exchange(body.code, body.verifier);
    const item = await this.provider.item(tokens.accessToken, body.itemId);
    const markdown = await this.provider.text(tokens.accessToken, body.itemId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const sha256 = createHash('sha256').update(markdown).digest('hex');
    await this.db.transaction(async manager => {
      const credentials = JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      await manager.insert(DocumentConnection, {
        id,
        ownerId,
        organizationId: membership.organizationId,
        fileId: item.id,
        provider: 'microsoft',
        title: item.name,
        currentVersion: 1,
        generation: 1,
        credentialEpoch: 0,
        credentials: seal(
          credentials,
          JSON.stringify(['microsoft-credentials', id, ownerId, membership.organizationId, 1]),
        ),
        connected: true,
        updatedAt: now,
      });
      await manager.insert(DocumentVersion, {
        documentId: id,
        version: 1,
        sourceVersion: item.lastModifiedAt ?? '',
        sourceModifiedAt: item.lastModifiedAt ?? now,
        capturedAt: now,
        sha256,
        byteSize: Buffer.byteLength(markdown, 'utf8'),
      });
      await manager.insert(
        DocumentChunk,
        chunks(markdown).map((content, position) => ({
          documentId: id,
          version: 1,
          position,
          content,
        })),
      );
    });
    return { documentId: id, version: 1, title: item.name };
  }
}
