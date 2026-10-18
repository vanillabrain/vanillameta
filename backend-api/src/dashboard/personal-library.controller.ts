import { Body, Controller, Get, Header, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PersonalLibraryService } from './personal-library.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class PersonalLibraryController {
  constructor(private readonly library: PersonalLibraryService) {}

  @Get('library') @Header('Cache-Control', 'no-store') list(
    @Query('view') view: unknown,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    return this.library.list(actor.id, view, actor.authVersion ?? 0);
  }

  @Put(':id/library') @Header('Cache-Control', 'no-store') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const actor = req.user.accessKeyData;
    // SourceAccessService performs strict positive numeric route-ID validation.
    return this.library.update(id, actor.id, body, actor.authVersion ?? 0);
  }
}
