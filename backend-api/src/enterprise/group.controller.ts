import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseGroupService } from './group.service';
@UseGuards(JwtAuthGuard)
@Controller('enterprise/groups')
export class EnterpriseGroupController {
  constructor(private readonly groups: EnterpriseGroupService) {}
  private id(raw: unknown) {
    if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('그룹 번호를 확인해 주세요.');
    return Number(raw);
  }
  @Get() list(@Req() req: any, @Query('afterId') after?: unknown) {
    return this.groups.list(
      req.user.accessKeyData.id,
      after === undefined ? undefined : this.id(after),
    );
  }
  @Post() create(@Req() req: any, @Body() body: unknown) {
    return this.groups.create(req.user.accessKeyData.id, body);
  }
  @Get(':id') detail(@Req() req: any, @Param('id') id: string) {
    return this.groups.detail(this.id(id), req.user.accessKeyData.id);
  }
  @Post(':id') set(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.groups.set(this.id(id), req.user.accessKeyData.id, body);
  }
}
