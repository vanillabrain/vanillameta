import { Body, Controller, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SheetsSourceService } from './sheets-source.service';

@UseGuards(JwtAuthGuard)
@Controller('documents/sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsSourceService) {}

  @Get('authorization')
  @Header('Cache-Control', 'no-store')
  authorization(@Query('verifier') verifier: string) {
    return this.sheets.authorization(verifier);
  }

  @Post('import')
  importSheet(@Req() req: unknown, @Body() body: unknown) {
    const { accessKeyData } = req as { accessKeyData: { id: number } };
    return this.sheets.importSheet(accessKeyData.id, body);
  }
}
