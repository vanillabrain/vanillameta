import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

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
      environment: process.env.NODE_ENV,
      database: process.env.NODE_ENV === 'local' ? 'sqlite' : 'mysql'
    };
  }

  @Post('/seed')
  async createSeedData() {
    return {
      message: 'Seed data endpoint ready',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    };
  }
}
