import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { MicrosoftDocsProvider } from './microsoft-docs.provider';

const verifier = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);
const body = z
  .object({
    code: z.string().min(1).max(4096),
    verifier,
    itemId: z.string().min(1).max(400),
  })
  .strict();

@Injectable()
export class MicrosoftSourceService {
  constructor(private readonly provider: MicrosoftDocsProvider) {}

  authorization(raw: string) {
    const parsed = verifier.safeParse(raw);
    if (!parsed.success) throw new BadRequestException('PKCE verifier가 올바르지 않습니다.');
    const state = randomBytes(16).toString('hex');
    return {
      authorizationUrl: this.provider.authorizationUrl({ state, verifier: parsed.data, itemId: '' }),
      state,
    };
  }

  async preview(input: unknown) {
    const parsed = body.parse(input);
    const tokens = await this.provider.exchange(parsed.code, parsed.verifier);
    const item = await this.provider.item(tokens.accessToken, parsed.itemId);
    const markdown = await this.provider.text(tokens.accessToken, parsed.itemId);
    return { ...item, markdown };
  }
}

