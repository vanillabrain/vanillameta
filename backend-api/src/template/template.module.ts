import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Template} from "./entities/template.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Template])],
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
