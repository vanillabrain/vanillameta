import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/ip')
  async getIp(): Promise<string> {
    return await this.appService.getIp();
  }

  @Post()
  postHello(@Body() body) {
    return body;
  }

  @Get('/health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
    };
  }
}

// API v1 헬스체크 컨트롤러
@ApiTags('health')
@Controller('api/v1')
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: '헬스체크 엔드포인트' })
  getApiHealth() {
    return {
      status: 'healthy',
      service: 'vanillameta-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      database: 'connected', // 실제로는 DB 연결 상태 확인 필요
      redis: 'connected', // 실제로는 Redis 연결 상태 확인 필요
    };
  }
}
