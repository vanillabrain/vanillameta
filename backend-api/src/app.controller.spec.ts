import { NotFoundException } from '@nestjs/common';
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

  describe('in production', () => {
    const previous = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'prod';
    });
    afterEach(() => {
      process.env.NODE_ENV = previous;
    });

    it('does not advertise the demo account', () => {
      expect(appController.getHello()).not.toHaveProperty('demo');
      expect(JSON.stringify(appController.getHello())).not.toContain('Admin!@12');
    });

    it('hides the diagnostic endpoints behind a 404', async () => {
      await expect(appController.getIp()).rejects.toBeInstanceOf(NotFoundException);
      expect(() => appController.postHello({ a: 1 })).toThrow(NotFoundException);
      await expect(appController.createSeedData()).rejects.toBeInstanceOf(NotFoundException);
    });
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
