import { Test, TestingModule } from '@nestjs/testing';
import { ShareUrlController } from './share-url.controller';
import { ShareUrlService } from './share-url.service';

describe('ShareUrlController', () => {
  let controller: ShareUrlController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareUrlController],
      providers: [ShareUrlService],
    }).compile();

    controller = module.get<ShareUrlController>(ShareUrlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
