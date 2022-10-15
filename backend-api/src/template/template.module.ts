import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { Widget } from '../widget/entities/widget.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template, TemplateItem, Widget])],
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
