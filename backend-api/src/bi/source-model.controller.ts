import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceModelService } from './source-model.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/source-models')
export class SourceModelController {
  constructor(private readonly models: SourceModelService) {}
  @Post('preview') async preview(@Body() body: any, @Req() req: any) {
    return {
      status: 'SUCCESS',
      data: await this.models.preview(body, req.user?.accessKeyData?.id),
    };
  }
  @Post('save') async save(@Body() body: any, @Req() req: any) {
    return { status: 'SUCCESS', data: await this.models.save(body, req.user?.accessKeyData?.id) };
  }
}
