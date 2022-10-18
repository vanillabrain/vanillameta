import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { In, Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
import { TemplateItem } from './entities/template-item.entity';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';
import { TemplateInfoDto } from './dto/template-info.dto';
import { ItemInfoDto } from './dto/item-info.dto';
import { async } from 'rxjs';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Widget } from '../widget/entities/widget.entity';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(TemplateItem)
    private readonly templateItemRepository: Repository<TemplateItem>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
  ) {}

  /**
   * 템플릿 추가
   * @param createTemplate
   */
  async create(createTemplate: CreateTemplateDto) {
    const insertTemplate = await this.templateRepository.save({
      title: createTemplate.title,
      description: createTemplate.description,
    });

    // 템플릿 상세
    const insertItems = [];
    createTemplate.layout.map(item =>{
      const tempObj = {templateId: insertTemplate.id, x: item.x, y: item.y, width: item.w, height: item.h, recommendCategory:item.category}
      insertItems.push(tempObj);
    })
    const insertItem = await this.templateItemRepository.save(insertItems);

    return { status: ResponseStatus.SUCCESS, data: insertTemplate };
  }

  /**
   * 템플릿 목록 조회
   */
  async findAll() {
    const result = await this.templateRepository.find({
      select: {
        id: true,
        title: true,
        description: true,
      },
      where: {
        useYn: YesNo.YES,
      },
    });

    return { status: ResponseStatus.SUCCESS, data: result };
  }

  /**
   * 템플릿 단건 조회
   * @param id
   */
  async findOne(id: number) {
    let returnObj: TemplateInfoDto;

    // 템플릿 기본 정보 조회
    const templateInfo = await this.templateRepository.findOne({
      select: {
        id: true,
        title: true,
        description: true,
      },
      where: {
        useYn: YesNo.YES,
        id: id,
      },
    });

    if (templateInfo.id) {
      returnObj = new TemplateInfoDto(templateInfo);
      // 템플릿 상세 아이템 조회(layout 조회 및 가공)
      const layoutList = await this.templateItemRepository.find({
        where: {
          templateId: templateInfo.id,
        },
      });
      const layout = [];
      layoutList.map(item => {
        const itemInfo: ItemInfoDto = new ItemInfoDto(item);
        layout.push(itemInfo);
      });
      returnObj.layout = layout;
    }

    return { status: ResponseStatus.SUCCESS, data: returnObj };
  }

  /**
   * 템플릿 업데이트
   * @param id
   * @param updateTemplate
   */
  async update(id: number, updateTemplate: UpdateTemplateDto) {
    const updateItem = await this.templateRepository.update(
      {
        id: id,
      },
      {
        title: updateTemplate.title,
        description: updateTemplate.description,
      },
    );

    // 템플릿 상세
    await this.templateItemRepository.delete({templateId:id});
    const insertItems = [];
    updateTemplate.layout.map(item =>{
      const tempObj = {templateId: id, x: item.x, y: item.y, width: item.w, height: item.h, recommendCategory:item.category}
      insertItems.push(tempObj);
    })
    await this.templateItemRepository.save(insertItems);

    if (updateItem.affected < 1) {
      return {
        status: ResponseStatus.ERROR,
        message: '변동사항 없음',
      };
    } else if (updateItem.affected > 1) {
      return {
        status: ResponseStatus.ERROR,
        message: '여러개 바뀜',
      };
    } else {
      return {
        status: ResponseStatus.SUCCESS,
        data: { message: `This action updates a #${id} template` },
      };
    }
  }

  /**
   * 템플릿 비활성화(useYn='N')
   * @param id
   */
  async remove(id: number) {
    const deleteItem = await this.templateRepository.update(
      {
        id: id,
      },
      {
        useYn: YesNo.NO,
      },
    );

    if (deleteItem.affected < 1) {
      return {
        status: ResponseStatus.ERROR,
        message: '변동사항 없음',
      };
    } else if (deleteItem.affected > 1) {
      return {
        status: ResponseStatus.ERROR,
        message: '여러개 바뀜',
      };
    } else {
      return {
        status: ResponseStatus.SUCCESS,
        data: { message: `#${id} template useYn='N' 변경완료 ` },
      };
    }
  }

  /**
   * 선택된 위젯목록으로 추천될 template 목록
   * @param widgets
   */
  async findRecommendTemplates(widgets: number[]) {
    const returnArr = [];
    const tempTemplateInfo = new TemplateItem();
    returnArr.push(tempTemplateInfo);

    const templateList = await this.templateRepository.find({
      select: {
        id: true,
        title: true,
        description: true,
      },
      where: {
        useYn: YesNo.YES,
      },
    });

    return { status: ResponseStatus.SUCCESS, data: templateList };
  }

  /**
   * 선택된 템플릿에 맞게 대시보드 레아이웃을 정해서 값을 보내줘야 한다.
   * @param widgets
   * @param templateId
   */
  async getTemplateDashboardLayout(widgets: number[], templateId: number) {
    const widgetList = await this.widgetRepository.find({ where: { id: In(widgets) } });

    let templateInfo: TemplateInfoDto;

    // 템플릿 기본 정보 조회
    const template = await this.templateRepository.findOne({
      select: {
        id: true,
        title: true,
        description: true,
      },
      where: {
        useYn: YesNo.YES,
        id: templateId,
      },
    });

    if (template.id) {
      templateInfo = new TemplateInfoDto(template);
      // 템플릿 상세 아이템 조회(layout 조회 및 가공)
      const layoutList = await this.templateItemRepository.find({
        where: {
          templateId: templateInfo.id,
        },
      });
      const layout = [];
      layoutList.map(item => {
        const itemInfo: ItemInfoDto = new ItemInfoDto(item);
        layout.push(itemInfo);
      });
      templateInfo.layout = layout;
    }

    widgetList[0].option = JSON.parse(widgetList[0].option);
    widgetList[1].option = JSON.parse(widgetList[1].option);

    templateInfo.widgets = [widgetList[0], widgetList[1]];
    templateInfo.layout[0].i = widgetList[0].id;
    templateInfo.layout[1].i = widgetList[1].id;
    return { status: ResponseStatus.SUCCESS, data: templateInfo };
  }
}
