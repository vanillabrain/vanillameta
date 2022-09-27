import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ComponentService } from './component.service';
import {CreateComponentDto} from "./dto/create-component.dto";

@Controller('component')
export class ComponentController {
  constructor(private readonly componentService: ComponentService,
  ) {}

  @Post()
  async multipleCreate(@Body() body:[]) {
    return this.componentService.multipleCreate(body);
  }
  // multiple cases

  // @Post('/short')
  // async shortCreate(@Body() body:CreateComponentDto) {
  //   return this.componentService.shortCreate(body)
  // }
  // short cases

  @Get()
  findAll() {
    return this.componentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.componentService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() body: any) {
    return this.componentService.update(+id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.componentService.remove(+id);
  }
}
