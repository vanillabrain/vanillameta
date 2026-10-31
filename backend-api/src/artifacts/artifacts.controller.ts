import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArtifactMultipartInterceptor } from './artifact-multipart';
import { ArtifactUpload } from './artifact-upload';
import { ArtifactActor, ArtifactsService } from './artifacts.service';

type ArtifactRequest = { user: { accessKeyData: ArtifactActor } };

function sendContent(res: Response, result: Awaited<ReturnType<ArtifactsService['content']>>) {
  res.set({
    'Content-Type': `${result.mimeType}${result.kind === 'html' ? '; charset=utf-8' : ''}`,
    'Content-Length': String(result.buffer.length),
    'Content-Disposition': `${
      result.kind === 'pptx' ? 'attachment' : 'inline'
    }; filename="artifact.${result.kind}"; filename*=UTF-8''${encodeURIComponent(
      result.originalName,
    ).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
  });
  res.send(result.buffer);
}

@UseGuards(JwtAuthGuard)
@Controller('artifacts/files')
export class ArtifactsController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get()
  list(@Req() req: ArtifactRequest) {
    return this.artifacts.list(req.user.accessKeyData);
  }

  @Post()
  @UseInterceptors(ArtifactMultipartInterceptor)
  upload(
    @Req() req: ArtifactRequest,
    @UploadedFile() file: ArtifactUpload,
    @Body('title') title?: unknown,
  ) {
    return this.artifacts.upload(req.user.accessKeyData, file, title);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Req() req: ArtifactRequest) {
    return this.artifacts.get(id, req.user.accessKeyData);
  }

  @Post(':id/versions')
  @UseInterceptors(ArtifactMultipartInterceptor)
  replace(
    @Param('id') id: string,
    @Req() req: ArtifactRequest,
    @UploadedFile() file: ArtifactUpload,
    @Body('expectedVersion') version: unknown,
  ) {
    return this.artifacts.replace(id, req.user.accessKeyData, file, version);
  }

  @Get(':id/versions/:version/content')
  async content(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() req: ArtifactRequest,
    @Res() res: Response,
  ) {
    sendContent(res, await this.artifacts.content(id, version, req.user.accessKeyData));
  }

  @Post(':id/share')
  share(@Param('id') id: string, @Req() req: ArtifactRequest, @Body() body: unknown) {
    return this.artifacts.createShare(id, req.user.accessKeyData, body);
  }

  @Delete(':id/share')
  @HttpCode(204)
  revoke(@Param('id') id: string, @Req() req: ArtifactRequest) {
    return this.artifacts.revokeShare(id, req.user.accessKeyData);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id') id: string,
    @Req() req: ArtifactRequest,
    @Body('expectedRevision') revision: unknown,
  ) {
    return this.artifacts.remove(id, req.user.accessKeyData, revision);
  }
}

@Controller('artifacts/shared')
export class ArtifactSharedController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get(':token')
  detail(@Param('token') token: string) {
    return this.artifacts.sharedDetail(token);
  }

  @Get(':token/content')
  async content(@Param('token') token: string, @Res() res: Response) {
    sendContent(res, await this.artifacts.sharedContent(token));
  }
}
