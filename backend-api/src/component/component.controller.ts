import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {ComponentService} from './component.service';
import {CreateComponentDto} from "./dto/create-component.dto";
import {UpdateComponentDto} from "./dto/update-component.dto";

@UseGuards(JwtAuthGuard)
@Controller('component')
export class ComponentController {
    constructor(private readonly componentService: ComponentService,
    ) {
    }

    @Post('/seed')
    async multipleCreate(@Body() createComponents: CreateComponentDto[]) {
        return this.componentService.multipleCreate(createComponents);
    }

    @Post()
    async create(@Body() createComponent: CreateComponentDto) {
        return this.componentService.create(createComponent);
    }

    @Get()
    findAll() {
        return this.componentService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.componentService.findOne(+id);
    }

    @Patch(':id')
    update(@Param('id') id: number, @Body() body: UpdateComponentDto) {
        return this.componentService.update(+id, body);
    }

    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.componentService.remove(+id);
    }
}
