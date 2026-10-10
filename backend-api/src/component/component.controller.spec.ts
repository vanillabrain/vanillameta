import { Test, TestingModule } from '@nestjs/testing';
import { ComponentController } from './component.controller';
import { ComponentService } from './component.service';

describe('ComponentController', () => {
  let controller: ComponentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComponentController],
      providers: [{ provide: ComponentService, useValue: {} }],
    }).compile();

    controller = module.get<ComponentController>(ComponentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
