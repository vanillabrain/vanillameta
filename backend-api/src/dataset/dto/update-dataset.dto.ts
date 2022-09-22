import { PartialType } from '@nestjs/mapped-types';
import { CreateDatasetDto } from './create-dataset.dto';

export class UpdateDatasetDto extends PartialType(CreateDatasetDto) {}
