import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Template} from "./entities/template.entity";
import {Repository} from "typeorm";

@Injectable()
export class TemplateService {
  constructor(
      @InjectRepository(Template)
      private readonly TemplateRepository: Repository<Template>
  ) {
  }
  async create(data: any) {
    console.log(data)
    await this.TemplateRepository.save({
      layout: data.layout,
      title:  data.title,
      description: data.description
    })
    return 'This action adds a new template';
  }

  findAll() {
    return `This action returns all template`;
  }

  findOne(id: number) {
    return `This action returns a #${id} template`;
  }

  update(id: number, updateTemplateDto: UpdateTemplateDto) {
    return `This action updates a #${id} template`;
  }

  remove(id: number) {
    return `This action removes a #${id} template`;
  }
}
