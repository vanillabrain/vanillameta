import { Injectable } from '@nestjs/common';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { InjectRepository } from "@nestjs/typeorm";
import { Component } from "./entities/component.entity";
import { Repository } from "typeorm";

@Injectable()
export class ComponentService {
  constructor(
      @InjectRepository(Component)
      private componentRepository: Repository<Component>) {}

  async multipleCreate(body: CreateComponentDto[]) {
    for(let i =0 ; body.length > i; i ++){
      const find_component = await this.componentRepository.findOne({ where: { title: body[i].title }})

      if(!find_component){

        await this.componentRepository.save({
          type: body[i].type,
          title: body[i].title,
          description: body[i].description,
          category: body[i].category,
          icon: body[i].icon,
          option: JSON.stringify(body[i].option),
          seq: body[i].seq,
          uesYn: body[i].useYn
        })
        return 'success add a new component'
      }
    }
    return 'already exist component';
  }

  // async shortCreate(body: CreateComponentDto) {
  //   const find_component = await this.componentRepository.findOne({ where: { title: body.title }})
  //   if(find_component){
  //     return 'exist same widget'
  //   } else {
  //     await this.componentRepository.save({
  //       type: body.type,
  //       title: body.title,
  //       description: body.description,
  //       category: body.category,
  //       icon: body.icon,
  //       option: JSON.stringify(body.option),
  //       seq: body.seq,
  //       uesYn: body.useYn
  //     })
  //   }
  //   return 'This action adds a new widget';
  // }

  async findAll() {
    const find_component = await this.componentRepository.find()
    return find_component;
  }

  async findOne(id: number) {
    const find_component_one = await this.componentRepository.findOne({ where: { id: id}})
    return find_component_one;
  }

  async update(id: number, body: any) {

    const find_component = await this.componentRepository.findOne({ where: { id: id}})
      if(!find_component){
        return 'No exist type'
      } else {
        find_component.type = body.type;
        find_component.title = body.title;
        find_component.description = body.description;
        find_component.category = body.category;
        find_component.option = JSON.stringify(body.option);
        find_component.icon = body.icon;
        find_component.seq = body.seq;
        find_component.useYn = body.useYn;

        await this.componentRepository.save(find_component)

        return 'Success update'
      }



  }

  async remove(id: number) {
    await this.componentRepository.delete({id})
    return `This action removes a #${id} component`;
  }
}
