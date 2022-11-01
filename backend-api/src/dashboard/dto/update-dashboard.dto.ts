import { PartialType } from '@nestjs/mapped-types';
import { CreateDashboardDto } from './create-dashboard.dto';
import {IsNotEmpty, IsNumber, IsOptional} from "class-validator";

export class UpdateDashboardDto extends PartialType(CreateDashboardDto) {
    @IsNumber()
    @IsOptional()
    dashboardId: number;
}
