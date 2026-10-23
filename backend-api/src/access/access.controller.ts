import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { AuthPublic } from '../auth/decorators/auth-public.decorator';
import { metadataTransaction } from '../common/metadata-work';
import { AccessService } from './access.service';

class JoinWaitlistDto {
  @IsString()
  @IsEmail()
  @MaxLength(255)
  email: string;
}

/** Public entry points of the invite beta: what signup currently requires, and the waiting list. */
@ApiTags('접근')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService, private readonly db: DataSource) {}

  @Get('signup-mode')
  @AuthPublic()
  @ApiOperation({ summary: '가입 방식(open/invite/closed)' })
  signupMode() {
    return { mode: this.access.signupMode() };
  }

  @Post('waitlist')
  @AuthPublic()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(5, 60)
  @ApiOperation({
    summary: '대기자 명단 등록',
    description: '같은 주소를 다시 보내도 같은 응답입니다.',
  })
  async joinWaitlist(@Body() body: JoinWaitlistDto) {
    await metadataTransaction(this.db, manager => this.access.joinWaitlist(manager, body.email));
    return { status: 'received' };
  }
}
