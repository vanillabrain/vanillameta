import { Controller, Get } from '@nestjs/common';
import { SampleService } from './sample.service';

@Controller('sample')
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Get()
  getHello() {
    return this.sampleService.getSampleList();
  }
}
