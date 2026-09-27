import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateDashboardWidgetDto {
  @IsNumber()
  @IsNotEmpty()
  dashboardId: number;

  @IsNotEmpty()
  widgetIds: number[];
}
