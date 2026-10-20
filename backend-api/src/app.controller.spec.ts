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
    it('returns the preserved main API descriptor', () => {
      expect(appController.getHello()).toMatchObject({
        message: 'Welcome to VanillaMeta API',
        version: '1.0.0',
      });
    });
  });
});
