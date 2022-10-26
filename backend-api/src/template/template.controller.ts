import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';
import { TemplateInfoDto } from './dto/template-info.dto';

@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * 템플릿 생성
   * @param createTemplateDto
   */
  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  /**
   * 템플릿 목록 조회
   */
  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  /**
   * 템플릿 단건 조회
   * @param id
   */
  @Get(':id')
  async findOne(@Res() res, @Param('id') id: number) {
    return await this.templateService.findOne(id);
  }

  /**
   * 템플릿 단건 업데이트
   * @param id
   * @param updateTemplateDto
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templateService.update(+id, updateTemplateDto);
  }

  /**
   * 템플릿 삭제 (사용여부 N 처리)
   * @param id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templateService.remove(+id);
  }

  /**
   * 템플릿 추천 목록 조회
   * @param widgets
   */
  //todo:: yhs:: 추천 알고리즘 적용해서 조회해 와야함
  @Post('/recommend')
  findRecommendAll(@Body() body) {
    return this.templateService.findRecommendTemplates(body.widgets);
  }

  /**
   * 선택된 템플릿에 맞게 대시보드 레아이웃을 정해서 값을 보내줘야 한다.
   * @param widgets
   * @param templateId
   */
  @Post('/dashboard')
  getTemplateDashboardLayout(@Body() data) {
    return this.templateService.getTemplateDashboardLayout(data.widgets, data.templateId);
  }
}
