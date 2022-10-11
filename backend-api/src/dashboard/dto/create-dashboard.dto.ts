import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDashboardDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsNotEmpty()
  layout: string;
}
