import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MiddlewareService } from './middleware.service';
import { CreateMiddlewareDto } from './dto/create-middleware.dto';
import { UpdateMiddlewareDto } from './dto/update-middleware.dto';

@Controller('middleware')
export class MiddlewareController {
  constructor(private readonly middlewareService: MiddlewareService) {}

  @Post()
  create(@Body() createMiddlewareDto: CreateMiddlewareDto) {
    return this.middlewareService.create(createMiddlewareDto);
  }

  @Get()
  findAll() {
    return this.middlewareService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.middlewareService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMiddlewareDto: UpdateMiddlewareDto) {
    return this.middlewareService.update(+id, updateMiddlewareDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.middlewareService.remove(+id);
  }
}
