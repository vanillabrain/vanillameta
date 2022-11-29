import { Test, TestingModule } from '@nestjs/testing';
import { MiddlewareController } from './middleware.controller';
import { MiddlewareService } from './middleware.service';

describe('MiddlewareController', () => {
  let controller: MiddlewareController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MiddlewareController],
      providers: [MiddlewareService],
    }).compile();

    controller = module.get<MiddlewareController>(MiddlewareController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
