import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API information object', () => {
      const result = appController.getHello();
      expect(result).toHaveProperty('message', 'Welcome to VanillaMeta API');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('description', '비즈니스 인텔리전스 플랫폼 API');
      expect(result).toHaveProperty('endpoints');
      expect(result.endpoints).toEqual({
        api: '/api/v1',
        docs: '/api/v1/docs',
        health: '/api/v1/health',
      });
      expect(result).toHaveProperty('demo');
      expect(result.demo).toEqual({
        username: 'guest',
        password: 'Admin!@12',
        note: '데모 계정으로 로그인하여 VanillaMeta를 체험해보세요!',
      });
    });
  });
});
