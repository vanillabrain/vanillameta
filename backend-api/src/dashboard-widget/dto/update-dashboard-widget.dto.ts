import { PartialType } from '@nestjs/swagger';
import { CreateDashboardWidgetDto } from './create-dashboard-widget.dto';

export class UpdateDashboardWidgetDto extends PartialType(CreateDashboardWidgetDto) {}
