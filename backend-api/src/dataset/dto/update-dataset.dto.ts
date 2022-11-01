import { IsString } from 'class-validator';

export class UpdateDatasetDto {
  @IsString()
  title: string;

  @IsString()
  query: string;
  // readonly setting before
}
