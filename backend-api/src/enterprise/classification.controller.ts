import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseClassificationService } from './classification.service';

@UseGuards(JwtAuthGuard)
@Controller('enterprise/classifications')
export class EnterpriseClassificationController {
  constructor(private readonly classifications: EnterpriseClassificationService) {}
  private id(raw: unknown) {
    if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('분류 번호 또는 목록 위치를 확인해 주세요.');
    return Number(raw);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() req: any, @Query('afterId') after?: unknown) {
    const actor = req.user.accessKeyData;
    return this.classifications.list(
      actor.id,
      actor.authVersion,
      after === undefined ? undefined : this.id(after),
    );
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() req: any, @Body() body: unknown) {
    const actor = req.user.accessKeyData;
    return this.classifications.create(actor.id, actor.authVersion, body);
  }
  @Post(':id')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  set(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const actor = req.user.accessKeyData;
    return this.classifications.set(this.id(id), actor.id, actor.authVersion, body);
  }
}
