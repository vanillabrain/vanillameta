import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseDeliveryService } from './delivery.service';
@UseGuards(JwtAuthGuard)
@Controller('enterprise/deliveries/dashboard')
export class EnterpriseDeliveryController {
  constructor(private readonly delivery: EnterpriseDeliveryService) {}
  private id(raw: string) {
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('대시보드 번호를 확인해 주세요.');
    return Number(raw);
  }
  private cursor(raw: unknown) {
    if (typeof raw !== 'string') throw new BadRequestException('목록 위치를 확인해 주세요.');
    return this.id(raw);
  }
  @Get('received') received(@Req() req: any, @Query('afterId') afterId?: unknown) {
    return this.delivery.received(
      req.user.accessKeyData.id,
      afterId === undefined ? undefined : this.cursor(afterId),
    );
  }
  @Get(':id') list(@Req() req: any, @Param('id') id: string) {
    return this.delivery.list(this.id(id), req.user.accessKeyData.id);
  }
  @Post(':id') set(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.delivery.set(this.id(id), req.user.accessKeyData.id, body);
  }
}
