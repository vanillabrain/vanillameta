import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseService } from './enterprise.service';

@Controller('enterprise')
@UseGuards(JwtAuthGuard)
export class EnterpriseController {
  constructor(private readonly service: EnterpriseService) {}

  @Post('enrollment')
  enrollment(@Req() request: any, @Body() body: unknown) {
    return this.service.enrollment(request.user.accessKeyData.id, body);
  }

  @Delete('enrollment')
  revokeEnrollment(@Req() request: any) {
    return this.service.revokeEnrollment(request.user.accessKeyData.id);
  }

  @Get('context')
  context(@Req() request: any) {
    return this.service.context(request.user.accessKeyData.id);
  }

  @Post('organizations')
  create(@Req() request: any, @Body() body: unknown) {
    return this.service.create(request.user.accessKeyData.id, body);
  }

  @Get('members')
  members(@Req() request: any, @Query('afterId') afterId?: unknown) {
    return this.service.members(request.user.accessKeyData.id, afterId);
  }

  @Post('members')
  add(@Req() request: any, @Body() body: unknown) {
    return this.service.add(request.user.accessKeyData.id, body);
  }

  @Patch('members/:id')
  update(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      throw new BadRequestException('잘못된 직원 번호입니다.');
    return this.service.update(request.user.accessKeyData.id, Number(id), body);
  }
}
