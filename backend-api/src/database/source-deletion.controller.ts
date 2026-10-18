import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceDeletionService } from './source-deletion.service';
@UseGuards(JwtAuthGuard)
@Controller('database')
export class SourceDeletionController {
  constructor(private readonly deletion: SourceDeletionService) {}
  @Get('deletions') @Header('Cache-Control', 'no-store') list(
    @Req() req: any,
    @Query() query: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.deletion.listReceipts(actor.id, query, actor.authVersion ?? 0);
  }
  @Get('deletions/:receiptId') @Header('Cache-Control', 'no-store') receipt(
    @Param('receiptId') id: string,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.deletion.getReceipt(id, actor.id, actor.authVersion ?? 0);
  }
  @Post('deletions/:receiptId/cleanup') @Header('Cache-Control', 'no-store') cleanup(
    @Param('receiptId') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.deletion.cleanup(id, actor.id, body, actor.authVersion ?? 0);
  }
  @Get(':id/delete-impact') @Header('Cache-Control', 'no-store') impact(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.deletion.impact(id, actor.id, actor.authVersion ?? 0);
  }
  @Delete(':id') @Header('Cache-Control', 'no-store') remove(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.deletion.remove(id, actor.id, body, actor.authVersion ?? 0);
  }
}
