import { IsOptional, IsString } from 'class-validator';

export class UpdateDatasetDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  query: string;
  // readonly setting before
}
