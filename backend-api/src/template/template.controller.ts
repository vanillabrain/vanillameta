import {Body, Controller, Delete, Get, Param, Post, Put} from '@nestjs/common';
import {TemplateService} from './template.service';
import {CreateTemplateDto} from './dto/create-template.dto';
import {UpdateTemplateDto} from './dto/update-template.dto';

@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.templateService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templateService.update(+id, updateTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templateService.remove(+id);
  }

  //todo:: yhs:: 추천 알고리즘 적용해서 조회해와야함
  @Post('/recommend')
  findRecommendAll(@Body() widgets: any[]) {
    this.templateService.findRecommendTemplates(widgets);
    return null;
  }
}
