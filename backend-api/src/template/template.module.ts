import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';

@Module({
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
