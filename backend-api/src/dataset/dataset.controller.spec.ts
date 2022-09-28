import { Test, TestingModule } from '@nestjs/testing';
import { DatasetController } from './dataset.controller';
import { DatasetService } from './dataset.service';

describe('DatasetController', () => {
  let controller: DatasetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasetController],
      providers: [DatasetService],
    }).compile();

    controller = module.get<DatasetController>(DatasetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
