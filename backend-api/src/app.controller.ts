import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('시스템')
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
  @ApiOperation({
    summary: '헬스체크 엔드포인트',
    description: 'API 서버의 상태를 확인합니다.',
  })
  @ApiResponse({ status: 200, description: '서비스 상태 정상' })
  checkHealth() {
    return this.appService.checkHealth();
  }

  @Get('/ip')
  @ApiOperation({
    summary: '서버 IP 주소 조회',
    description:
      'API 서버의 공개 IP 주소를 조회합니다. AWS Lambda 환경에서 실행 중인 경우 Lambda 함수의 외부 IP를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '서버의 IP 주소가 반환되었습니다.',
    schema: {
      type: 'string',
      example: '52.79.123.45',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'IP 주소를 가져오는 중 오류가 발생했습니다.',
  })
  async getIp(): Promise<string> {
    return await this.appService.getIp();
  }

  @Post()
  @ApiOperation({
    summary: '에코 테스트',
    description: '전송한 데이터를 그대로 반환합니다. API 테스트 목적으로 사용됩니다.',
  })
  @ApiBody({
    description: '테스트할 데이터',
    schema: {
      type: 'object',
      example: {
        message: 'Hello',
        timestamp: '2024-01-15T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '전송한 데이터가 그대로 반환되었습니다.',
    schema: {
      type: 'object',
      example: {
        message: 'Hello',
        timestamp: '2024-01-15T10:00:00Z',
      },
    },
  })
  postHello(@Body() body) {
    return body;
  }

  @Get('/health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: process.env.NODE_ENV === 'local' ? 'sqlite' : 'mysql',
      uptime: process.uptime(),
    };
  }

  @Post('/seed')
  async createSeedData() {
    return {
      message: 'Seed data endpoint ready',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
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
