import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello Vanilla Meta World - ' + process.env.NODE_ENV;
  }

  async getIp(): Promise<string> {
    const url = 'https://lumtest.com/myip.json';
    const response = await axios.get(url);
    return response.data;
  }

  checkHealth(): any {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
