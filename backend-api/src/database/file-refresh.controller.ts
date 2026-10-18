import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceAccessService } from '../ownership/source-access.service';
import { AnalysisUpload } from '../analysis/duckdb.service';
import { FileRefreshService } from './file-refresh.service';

/** Authorize before Multer writes an incoming upload. Shared read tokens cannot start or inspect jobs. */
@Injectable()
export class FileRefreshOwnerGuard implements CanActivate {
  constructor(private readonly access: SourceAccessService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    await this.access.assert(
      'database',
      req.params.id,
      this.access.actor(req.user?.accessKeyData?.id),
    );
    return true;
  }
}
@UseGuards(JwtAuthGuard, FileRefreshOwnerGuard)
@Controller('database/:id/file-refreshes')
export class FileRefreshController {
  constructor(private readonly refreshes: FileRefreshService) {}
  private actor(req: any) {
    return req.user?.accessKeyData?.id;
  }
  @Get('latest') async latest(@Param('id') id: string, @Req() req) {
    return { status: 'SUCCESS', data: await this.refreshes.latest(id, this.actor(req)) };
  }
  @Get(':requestId') async get(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Req() req,
  ) {
    return { status: 'SUCCESS', data: await this.refreshes.get(id, requestId, this.actor(req)) };
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const root = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'incoming');
          fs.mkdir(root, { recursive: true, mode: 0o700 }, error => cb(error, root));
        },
        filename: (_req, _file, cb) => cb(null, randomUUID()),
      }),
      limits: {
        fileSize: Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async start(
    @Param('id') id: string,
    @UploadedFile() file: AnalysisUpload,
    @Body('expectedRevision') revision: string,
    @Body('requestId') requestId: string,
    @Body('correction') correction: unknown,
    @Req() req,
  ) {
    return {
      status: 'SUCCESS',
      data: await this.refreshes.start(id, file, revision, requestId, this.actor(req), correction),
    };
  }
  @Post(':requestId/retry') async retry(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Req() req,
  ) {
    return { status: 'SUCCESS', data: await this.refreshes.retry(id, requestId, this.actor(req)) };
  }
  @Post(':requestId/cancel') async cancel(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Req() req,
  ) {
    return { status: 'SUCCESS', data: await this.refreshes.cancel(id, requestId, this.actor(req)) };
  }
}
