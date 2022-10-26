import { Injectable } from '@nestjs/common';
import { CreateComponentDto } from './dto/create-component.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Component } from './entities/component.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
import { UpdateComponentDto } from './dto/update-component.dto';

@Injectable()
export class ComponentService {
  constructor(
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
  ) {}

  async multipleCreate(createComponents: CreateComponentDto[]) {
    createComponents.forEach(item => {
      item.option = JSON.stringify(item.option);
    });

    return await this.componentRepository.save(createComponents);
  }

  async create(createComponent: CreateComponentDto) {
    const find_component = await this.componentRepository.findOne({
      where: { type: createComponent.type },
    });
    if (find_component) {
      return 'exist same widget';
    } else {
      const saveObj: CreateComponentDto = new CreateComponentDto();
      saveObj.type = createComponent.type;
      saveObj.title = createComponent.title;
      saveObj.category = createComponent.category;
      saveObj.option = JSON.stringify(createComponent.option);

      if (createComponent.seq) saveObj.seq = createComponent.seq;
      if (createComponent.useYn) saveObj.useYn = createComponent.useYn;
      if (createComponent.icon) saveObj.icon = createComponent.icon;
      if (createComponent.description) saveObj.description = createComponent.description;

      return await this.componentRepository.save(saveObj);
    }
  }

  async findAll() {
    // const components = await this.componentRepository.find({
    //   select: ['type'],
    //   where: { useYn: YesNo.YES },
    // });

    const components = await this.componentRepository
      .createQueryBuilder('component')
      .select([
        'id',
        'type as componentType',
        'title',
        'description',
        'category',
        'component.option as `option`',
        'icon',
        'seq',
      ])
      .where({ useYn: YesNo.YES })
      .getRawMany();

    components.forEach((component, index) => {
      component.option = JSON.parse(component.option);
    });

    return components;
  }

  async findOne(id: number) {
    const find_component_one = await this.componentRepository.findOne({ where: { id: id } });
    return find_component_one;
  }

  async update(id: number, updateComponent: UpdateComponentDto) {
    const find_component = await this.componentRepository.findOne({ where: { id: id } });
    if (!find_component) {
      return 'No exist type';
    } else {
      const updateObj: UpdateComponentDto = new UpdateComponentDto();

      updateObj.type = updateComponent.type;
      updateObj.title = updateComponent.title;
      updateObj.category = updateComponent.category;
      updateObj.description = updateComponent.description;
      updateObj.option = JSON.stringify(updateComponent.option);
      updateObj.icon = updateComponent.icon;
      updateObj.seq = updateComponent.seq;
      updateObj.useYn = updateComponent.useYn;

      await this.componentRepository.save(updateObj);

      return 'Success update';
    }
  }

  async remove(id: number) {
    await this.componentRepository.delete({ id });
    return `This action removes a #${id} component`;
  }
}
