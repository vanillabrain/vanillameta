import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LegacyOperationsGuard } from '../auth/guards/legacy-operations.guard';
import { ComponentController } from './component.controller';
import { ComponentService } from './component.service';

describe('ComponentController', () => {
  let controller: ComponentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComponentController],
      providers: [{ provide: ComponentService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LegacyOperationsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ComponentController>(ComponentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
