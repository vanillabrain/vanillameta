import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
import { TemplateItem } from './entities/template-item.entity';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';
import { TemplateInfoDto } from './dto/template-info.dto';
import { ItemInfoDto } from './dto/item-info.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(TemplateItem)
    private readonly templateItemRepository: Repository<TemplateItem>,
  ) {}

  /**
   * 템플릿 추가
   * @param createTemplate
   */
  async create(createTemplate: CreateTemplateDto): Promise<Template> {
    const insertItem = await this.templateRepository.save({
      title: createTemplate.title,
      description: createTemplate.description,
    });
    return insertItem;
  }

  /**
   * 템플릿 상세 아이템 추가
   * @param createTemplateItem
   */
  async createItem(createTemplateItem: CreateTemplateItemDto): Promise<TemplateItem> {
    const insertItem = await this.templateItemRepository.save({
      templateId: createTemplateItem.templateId,
      x: createTemplateItem.x,
      y: createTemplateItem.y,
      width: createTemplateItem.width,
      height: createTemplateItem.height,
      recommendCategory: createTemplateItem.recommendCategory,
    });
    return insertItem;
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

    return result;
  }

  /**
   * 템플릿 단건 조회
   * @param id
   */
  async findOne(id: number): Promise<TemplateInfoDto> {
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

    return returnObj;
  }

  /**
   * 템플릿 업데이트
   * @param id
   * @param updateTemplateDto
   */
  async update(id: number, updateTemplateDto: UpdateTemplateDto) {
    const updateItem = await this.templateRepository.update(
      {
        id: id,
      },
      {
        title: updateTemplateDto.title,
        description: updateTemplateDto.description,
      },
    );

    let msg = `This action updates a #${id} template`;
    if (updateItem.affected < 1) {
      msg = '변동사항 없음';
    } else if (updateItem.affected > 1) {
      msg = '여러개 바뀜';
    }
    return msg;
  }

  /**
   * 템플릿 상세 아이템 수정
   * @param id
   * @param updateTemplateItem
   */
  async updateItem(id: number, updateTemplateItem: UpdateTemplateItemDto) {
    const updateItem = await this.templateItemRepository.update(
      {
        id: id,
      },
      {
        x: updateTemplateItem.x,
        y: updateTemplateItem.y,
        width: updateTemplateItem.width,
        height: updateTemplateItem.height,
        recommendCategory: updateTemplateItem.recommendCategory,
      },
    );

    let msg = `This action updates a #${id} templateItem`;
    if (updateItem.affected < 1) {
      msg = '변동사항 없음';
    } else if (updateItem.affected > 1) {
      msg = '여러개 바뀜';
    }
    return msg;
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

    let msg = `#${id} template useYn='N' 변경완료 `;
    if (deleteItem.affected < 1) {
      msg = '변동사항 없음';
    } else if (deleteItem.affected > 1) {
      msg = '여러개 바뀜';
    }
    return msg;
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

    // return result;

    return templateList;
  }

  /**
   * 선택된 템플릿에 맞게 대시보드 레아이웃을 정해서 값을 보내줘야 한다.
   * @param widgets
   * @param templateId
   */
  async getTemplateDashboardLayout(widgets: number[], templateId: number) {
    const widget1 = {
      widgetId: 1,
      title: '라인차트 위젯',
      date: '2022-04-11T18:27:45+09:00',
      dataSetId: '000001',
      type: 'CHART_LINE',
      option: {
        xField: 'name',
        series: [
          {
            field: 'high',
            color: '#43afef',
            aggregation: '',
          },
          {
            field: 'low',
            color: '#b9e7ff',
            aggregation: '',
          },
          {
            field: 'avg',
            color: '#d9d9d9',
            aggregation: '',
          },
        ],
        legendPosition: 'left',
      },
    };

    const widget2 = {
      widgetId: 2,
      title: '파이차트 위젯',
      date: '2022-04-11T18:27:45+09:00',
      dataSetId: '00001',
      type: 'CHART_PIE',
      option: {
        xField: 'name',
        series: {
          field: 'high',
          color: [
            '#5470c6',
            '#91cc75',
            '#fac858',
            '#ee6666',
            '#73c0de',
            '#3ba272',
            '#fc8452',
            '#9a60b4',
            '#ea7ccc',
            '#5470c6',
            '#91cc75',
            '#fac858',
          ],
          aggregation: '',
          label: 'name',
        },
        legendPosition: 'right',
      },
    };

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

    templateInfo.widgets = [widget1, widget2];
    templateInfo.layout[0].i = widget1.widgetId;
    templateInfo.layout[1].i = widget2.widgetId;
    return templateInfo;
  }
}
