
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDashboardWidgetDto {
    @IsNumber()
    @IsNotEmpty()
    dashboardId: number;

    @IsString()
    @IsNotEmpty()
    widgetId: string;
}

