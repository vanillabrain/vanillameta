import { PartialType } from '@nestjs/swagger';
import { CreateWidgetViewDto } from './create-widget-view.dto';

export class UpdateWidgetViewDto extends PartialType(CreateWidgetViewDto) {}
