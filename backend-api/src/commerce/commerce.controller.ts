import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommerceStudioService } from './commerce-studio.service';
import { CommerceService } from './commerce.service';
import { requestEpoch } from '../ai/ai-caller';

@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Controller('commerce')
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly studio: CommerceStudioService,
  ) {}

  private actor(req: any): number {
    const id = Number(req?.user?.accessKeyData?.id);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('invalid user');
    return id;
  }

  @Post('sample')
  sample(@Req() req: any) {
    return this.commerce.openSample(this.actor(req));
  }

  @UserThrottle('ai')
  @Post('sample-help')
  async sampleHelp(@Body() body: any, @Req() req: any, @Res({ passthrough: true }) res) {
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    const onClose = () => {
      if (!res.writableFinished) abort.abort();
    };
    req.once('aborted', onAbort);
    res.once('close', onClose);
    if (req.aborted) abort.abort();
    try {
      return await this.commerce.sampleHelp(this.actor(req), body, abort.signal, requestEpoch(req));
    } finally {
      req.off('aborted', onAbort);
      res.off('close', onClose);
    }
  }

  @UserThrottle('ai')
  @Post('import-help')
  async importHelp(@Body() body: any, @Req() req: any, @Res({ passthrough: true }) res) {
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    const onClose = () => {
      if (!res.writableFinished) abort.abort();
    };
    req.once('aborted', onAbort);
    res.once('close', onClose);
    if (req.aborted) abort.abort();
    try {
      return await this.commerce.importHelp(this.actor(req), body, abort.signal, requestEpoch(req));
    } finally {
      req.off('aborted', onAbort);
      res.off('close', onClose);
    }
  }

  @Post('sources')
  createSource(@Body() body: { name: string }, @Req() req: any) {
    return this.commerce.createSource(this.actor(req), body?.name);
  }

  @Post(':id/studio-source')
  studioSource(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.studio.connect(this.actor(req), id);
  }

  @Get('sources')
  listSources(@Req() req: any) {
    return this.commerce.listSources(this.actor(req));
  }

  @UserThrottle('upload')
  @Post('sources/:id/import')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'orders', maxCount: 1 },
        { name: 'payments', maxCount: 1 },
        { name: 'refunds', maxCount: 1 },
        { name: 'customers', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const dir = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'commerce-incoming');
            fs.mkdir(dir, { recursive: true, mode: 0o700 }, error => cb(error, dir));
          },
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: {
          fileSize: Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024,
          files: 4,
        },
      },
    ),
  )
  importBundle(
    @Param('id', ParseIntPipe) sourceId: number,
    @UploadedFiles() files: Record<string, UploadedCommerceFile[]>,
    @Body() body: { sampleType?: 'normal' | 'error' },
    @Req() req: any,
  ) {
    return this.commerce.importBundle(this.actor(req), sourceId, files || {}, body?.sampleType);
  }

  @Get()
  projects(@Req() req: any) {
    return this.commerce.listProjects(this.actor(req));
  }

  @UserThrottle('upload')
  @Post('import')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'orders', maxCount: 1 },
        { name: 'payments', maxCount: 1 },
        { name: 'refunds', maxCount: 1 },
        { name: 'customers', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const dir = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'commerce-incoming');
            fs.mkdir(dir, { recursive: true, mode: 0o700 }, error => cb(error, dir));
          },
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: {
          fileSize: Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024,
          files: 4,
        },
      },
    ),
  )
  importNew(
    @Body() body: { name: string; projectId?: string | number; sampleType?: 'normal' | 'error' },
    @UploadedFiles() files: Record<string, UploadedCommerceFile[]>,
    @Req() req: any,
  ) {
    return this.commerce.createAndImport(
      this.actor(req),
      body?.name,
      files || {},
      body?.sampleType,
      body?.projectId == null || body.projectId === '' ? undefined : Number(body.projectId),
    );
  }

  @Get('runs/:id')
  getRun(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.commerce.getRun(this.actor(req), id);
  }

  @Get(':id/report')
  report(
    @Param('id', ParseIntPipe) id: number,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('channel') channel: string,
    @Req() req: any,
  ) {
    return this.commerce.frontendReport(this.actor(req), id, start ?? from, end ?? to, channel);
  }

  @UserThrottle('ai')
  @Post(':id/ai')
  aiDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      prompt: string;
      currentPresentation?: any;
      start?: string;
      end?: string;
      channel?: string;
    },
    @Req() req: any,
  ) {
    return this.commerce.aiDraft(this.actor(req), id, body, requestEpoch(req));
  }

  @Put(':id/presentation')
  savePresentation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { presentation: any },
    @Req() req: any,
  ) {
    return this.commerce.savePresentation(this.actor(req), id, body?.presentation);
  }
}

type UploadedCommerceFile = { path: string; originalname: string; size: number };
