import { Body, Controller, Delete, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MetricDeletionService } from './metric-deletion.service';
@UseGuards(JwtAuthGuard)
@Controller('metric')
export class MetricDeletionController {
  constructor(private readonly deletion: MetricDeletionService) {}
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
