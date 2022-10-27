import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDashboardDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsNotEmpty()
  layout: DashboardLayout[];
}

export class DashboardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
}
