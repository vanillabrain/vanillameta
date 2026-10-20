import { SourceAccessService } from '../ownership/source-access.service';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShareUrlController } from './share-url.controller';
import { ShareUrlService } from './share-url.service';

describe('ShareUrlController', () => {
  let controller: ShareUrlController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareUrlController],
      providers: [
        { provide: SourceAccessService, useValue: {} },
        { provide: ShareUrlService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ShareUrlController>(ShareUrlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
