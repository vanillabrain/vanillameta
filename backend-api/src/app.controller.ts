import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API 루트 엔드포인트' })
  @ApiResponse({ status: 200, description: 'API 정보 반환' })
  getHello(): any {
    return {
      message: 'Welcome to VanillaMeta API',
      version: '1.0.0',
      description: '비즈니스 인텔리전스 플랫폼 API',
      endpoints: {
        api: '/api/v1',
        docs: '/api/v1/docs',
        health: '/api/v1/health',
      },
      demo: {
        username: 'guest',
        password: 'Admin!@12',
        note: '데모 계정으로 로그인하여 VanillaMeta를 체험해보세요!',
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: '헬스체크 엔드포인트' })
  @ApiResponse({ status: 200, description: '서비스 상태 정상' })
  checkHealth() {
    return this.appService.checkHealth();
  }
}
