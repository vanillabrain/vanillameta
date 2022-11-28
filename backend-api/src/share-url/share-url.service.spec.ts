import { Test, TestingModule } from '@nestjs/testing';
import { ShareUrlService } from './share-url.service';

describe('ShareUrlService', () => {
  let service: ShareUrlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShareUrlService],
    }).compile();

    service = module.get<ShareUrlService>(ShareUrlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
