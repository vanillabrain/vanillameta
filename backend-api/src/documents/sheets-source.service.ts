import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { GoogleSheetsProvider } from './google-sheets.provider';
import { sheetUploadFile } from './sheets-source';

const verifierSchema = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);
const bodySchema = z
  .object({
    code: z.string().min(1).max(4096),
    verifier: verifierSchema,
    spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
    range: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
  })
  .strict();

@Injectable()
export class SheetsSourceService {
  constructor(
    private readonly sheets: GoogleSheetsProvider,
    private readonly database: DatabaseService,
  ) {}

  authorization(rawVerifier: string) {
    const parsed = verifierSchema.safeParse(rawVerifier);
    if (!parsed.success) throw new BadRequestException('PKCE verifier가 올바르지 않습니다.');
    const state = randomBytes(16).toString('hex');
    return {
      authorizationUrl: this.sheets.authorizationUrl({ state, verifier: parsed.data }),
      state,
    };
  }

  async importSheet(ownerId: number, input: unknown) {
    const body = bodySchema.parse(input);
    const tokens = await this.sheets.exchange(body.code, body.verifier);
    const rows = await this.sheets.values(tokens.accessToken, body.spreadsheetId, body.range);
    const upload = sheetUploadFile(body.name, rows);
    const database = await this.database.uploadFile(upload as never, ownerId);
    return {
      databaseId: database.data.id,
      name: database.data.name,
      columns: upload.columns,
      rowCount: upload.rowCount,
    };
  }
}
