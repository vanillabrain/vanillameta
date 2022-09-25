import { Injectable } from '@nestjs/common';
import { Sample } from './entities/sample.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SampleService {
  constructor(
    @InjectRepository(Sample)
    private readonly sampleRepository: Repository<Sample>,
  ) {}

  getSampleList() {
    return this.sampleRepository.find();
  }
}
