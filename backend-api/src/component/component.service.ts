import { Injectable } from '@nestjs/common';
import { CreateComponentDto } from './dto/create-component.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Component } from './entities/component.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
import { UpdateComponentDto } from './dto/update-component.dto';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';

@Injectable()
export class ComponentService {
  private readonly CACHE_KEY_PREFIX = 'component';
  private readonly CACHE_TTL = 3600; // 1시간

  constructor(
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
    private readonly cacheService: HybridCacheService,
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

      const result = await this.componentRepository.save(saveObj);
      
      // 캐시 무효화
      await this.cacheService.invalidateByEngine(this.CACHE_KEY_PREFIX);
      
      return result;
    }
  }

  async findAll() {
    const cacheKey = 'findAll';
    const cachedResult = await this.cacheService.get(
      this.CACHE_KEY_PREFIX,
      'static',
      cacheKey,
    );

    if (cachedResult) {
      return cachedResult.data;
    }

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

    // 캐시에 저장
    await this.cacheService.set(
      this.CACHE_KEY_PREFIX,
      'static',
      cacheKey,
      components,
      [],
      [],
      { ttl: this.CACHE_TTL }
    );

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
      
      // 캐시 무효화
      await this.cacheService.invalidateByEngine(this.CACHE_KEY_PREFIX);

      return 'Success update';
    }
  }

  async remove(id: number) {
    await this.componentRepository.delete({ id });
    
    // 캐시 무효화
    await this.cacheService.invalidate(this.CACHE_KEY_PREFIX, 'static', 'findAll');
    
    return `This action removes a #${id} component`;
  }
}
