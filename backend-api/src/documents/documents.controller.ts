import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { documentActorSchema, DocumentsService } from './documents.service';
import { MicrosoftDocsProvider } from './microsoft-docs.provider';
import { GoogleSheetsProvider } from './google-sheets.provider';
function actor(request: unknown) {
  if (!request || typeof request !== 'object' || !('user' in request))
    throw new BadRequestException();
  const user = request.user;
  if (!user || typeof user !== 'object' || !('accessKeyData' in user))
    throw new BadRequestException();
  const parsed = documentActorSchema.safeParse(user.accessKeyData);
  if (!parsed.success) throw new BadRequestException();
  return parsed.data;
}
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly microsoft: MicrosoftDocsProvider,
    private readonly sheets: GoogleSheetsProvider,
  ) {}
  @Get() @Header('Cache-Control', 'no-store') list(@Req() req: unknown) {
    return this.service.list(actor(req));
  }
  @Get('integrations') @Header('Cache-Control', 'no-store') integrations() {
    return {
      googleDocs: this.service.googleConfigured(),
      microsoft: this.microsoft.configured(),
      sheets: this.sheets.configured(),
    };
  }
  @Post('google/start') start(@Req() req: unknown, @Body() body: unknown) {
    return this.service.start(actor(req), body);
  }
  @Post('google/complete') complete(@Req() req: unknown, @Body() body: unknown) {
    return this.service.complete(actor(req), body);
  }
  @Get(':id') @Header('Cache-Control', 'no-store') read(
    @Req() req: unknown,
    @Param('id') id: string,
  ) {
    return this.service.read(actor(req), id);
  }
  @Get(':id/versions/:version') @Header('Cache-Control', 'no-store') version(
    @Req() req: unknown,
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return this.service.read(actor(req), id, /^\d+$/.test(version) ? Number(version) : NaN);
  }
  @Post(':id/refresh') refresh(
    @Req() req: unknown,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.refresh(actor(req), id, body);
  }
  @Post(':id/summary') aiSummary(
    @Req() req: unknown,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.aiSummary(actor(req), id, body);
  }
  @Get(':id/requests/:requestId') @Header('Cache-Control', 'no-store') request(
    @Req() req: unknown,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.service.request(actor(req), id, requestId);
  }
  @Post(':id/disconnect') disconnect(
    @Req() req: unknown,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.disconnect(actor(req), id, body);
  }
  @Get(':id/shares') @Header('Cache-Control', 'no-store') shares(
    @Req() req: unknown,
    @Param('id') id: string,
  ) {
    return this.service.shares(actor(req), id);
  }
  @Post(':id/shares') share(@Req() req: unknown, @Param('id') id: string, @Body() body: unknown) {
    return this.service.share(actor(req), id, body);
  }
}
