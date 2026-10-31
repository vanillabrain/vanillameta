import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MicrosoftSourceService } from './microsoft-source.service';

@UseGuards(JwtAuthGuard)
@Controller('documents/microsoft')
export class MicrosoftController {
  constructor(private readonly microsoft: MicrosoftSourceService) {}

  @Get('authorization')
  @Header('Cache-Control', 'no-store')
  authorization(@Query('verifier') verifier: string) {
    return this.microsoft.authorization(verifier);
  }

  @Post('preview')
  preview(@Body() body: unknown) {
    return this.microsoft.preview(body);
  }
}

