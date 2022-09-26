import { Injectable } from '@nestjs/common';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@Injectable()
export class ComponentService {
  create(createComponentDto: CreateComponentDto) {
    return 'This action adds a new component';
  }

  findAll() {
    return `This action returns all component`;
  }

  findOne(id: number) {
    return `This action returns a #${id} component`;
  }

  update(id: number, updateComponentDto: UpdateComponentDto) {
    return `This action updates a #${id} component`;
  }

  remove(id: number) {
    return `This action removes a #${id} component`;
  }
}
