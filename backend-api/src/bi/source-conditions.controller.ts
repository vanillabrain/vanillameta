import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceConditionsService } from './source-conditions.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/source-conditions')
export class SourceConditionsController {
  constructor(private readonly conditions: SourceConditionsService) {}
  @Post('read') async read(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.conditions.read(body, req.user.accessKeyData.id) };
  }
  @Post('preview') async preview(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.conditions.preview(body, req.user.accessKeyData.id),
    };
  }
  @Post('profile') async profile(@Body() body: unknown, @Req() req) {
    return {
      status: 'SUCCESS',
      data: await this.conditions.profile(body, req.user.accessKeyData.id),
    };
  }
  @Post('save') async save(@Body() body: unknown, @Req() req) {
    return { status: 'SUCCESS', data: await this.conditions.save(body, req.user.accessKeyData.id) };
  }
}
