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
import { Component } from '../component/entities/component.entity';
import { ComponentType } from '../common/enum/component-type.enum';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(TemplateItem)
    private readonly templateItemRepository: Repository<TemplateItem>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private readonly componentRepository: Repository<Component>,
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
    createTemplate.layout.map(item => {
      const tempObj = {
        templateId: insertTemplate.id,
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
        recommendCategory: item.category,
      };
      insertItems.push(tempObj);
    });
    await this.templateItemRepository.save(insertItems);

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
    await this.templateItemRepository.delete({ templateId: id });
    const insertItems = [];
    updateTemplate.layout.map(item => {
      const tempObj = {
        templateId: id,
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
        recommendCategory: item.category,
      };
      insertItems.push(tempObj);
    });
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
   * 선택된 위젯목록으로 추천될 template 목록 가져오기
   * @param widgets
   */
  async findRecommendTemplates(widgets: number[]) {
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
      .subQuery()
      .select(['widget.*'])
      .from(Widget, 'widget')
      .where('id in (:id)')
      .getQuery();

    const widgetList = await this.componentRepository
      .createQueryBuilder('component')
      .select([
        'widget.*',
        'component.category as componentCategory',
        'component.type as componentType',
      ])
      // .select([
      //   `sum(case when component.category = 'HORIZONTAL' then 1 else 0 end) as horizontalCnt`,
      //   `sum(case when component.category = 'VERTICAL' then 1 else 0 end) as verticalCnt`,
      //   `sum(case when component.category = 'SQUARE' then 1 else 0 end) as squareCnt`,
      //   `sum(case when component.category = 'SCORE' then 1 else 0 end) as scoreCnt`,
      //   `sum(1) as widgetCnt`,
      // ])
      .innerJoin(widgetInfo, 'widget', 'widget.componentId = component.id')
      .setParameter('id', widgets)
      .getRawMany();
    // .getRawOne();

    // 템플릿 추천 알고리즘
    await this.getRecommendTemplates(widgetList);

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
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
      .subQuery()
      .select(['widget.*'])
      .from(Widget, 'widget')
      .where('id in (:ids)')
      .getQuery();

    const widgetList = await this.componentRepository
      .createQueryBuilder('component')
      .select(['widgetInfo.*', 'component.type as componentType'])
      .innerJoin(widgetInfo, 'widgetInfo', 'widgetInfo.componentId = component.id')
      .setParameter('ids', widgets)
      .getRawMany();

    // const widgetList = await this.widgetRepository.find({ where: { id: In(widgets) } });

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

    widgetList.forEach((item, i) => {
      item.option = JSON.parse(item.option);
      // templateInfo.widgets.push(item);
      if (templateInfo.layout.length > i && template) templateInfo.layout[i].i = item.id;
    });

    templateInfo.widgets = widgetList;

    //
    // widgetList[0].option = JSON.parse(widgetList[0].option);
    // widgetList[1].option = JSON.parse(widgetList[1].option);
    //
    // templateInfo.widgets = [widgetList[0], widgetList[1]];
    // templateInfo.layout[0].i = widgetList[0].id;
    // templateInfo.layout[1].i = widgetList[1].id;
    return { status: ResponseStatus.SUCCESS, data: templateInfo };
  }

  /**
   * 템플릿 추천 목록 계산
   * @private
   * @param widgetList
   */
  private async getRecommendTemplates(widgetList) {
    // widget component별 개수 정리
    const widgetComponentInfo = {
      horizontalCnt: 0,
      verticalCnt: 0,
      squareCnt: 0,
      scoreCnt: 0,
      tableCnt: 0,
      widgetCnt: widgetList.length,
    };

    widgetList.map(item => {
      switch (item.componentCategory) {
        case ComponentType.HORIZONTAL:
          widgetComponentInfo.horizontalCnt += 1;
          break;
        case ComponentType.VERTICAL:
          widgetComponentInfo.verticalCnt += 1;
          break;
        case ComponentType.SCORE:
          widgetComponentInfo.scoreCnt += 1;
          break;
        case ComponentType.SQUARE:
          widgetComponentInfo.squareCnt += 1;
          break;
        case ComponentType.TABLE:
          widgetComponentInfo.tableCnt += 1;
          break;
        default:
          break;
      }
    });

    const templates = this.templateRepository
      .createQueryBuilder()
      .subQuery()
      .select(['template.id as id'])
      .from(Template, 'template')
      .where(`useYn = 'Y'`)
      .getQuery();

    const templateComponentInfo = await this.templateItemRepository
      .createQueryBuilder('templateItems')
      .select([
        'template.id as id',
        `sum(case when templateItems.recommendCategory = 'HORIZONTAL' then 1 else 0 end) as horizontalCnt`,
        `sum(case when templateItems.recommendCategory = 'VERTICAL' then 1 else 0 end) as verticalCnt`,
        `sum(case when templateItems.recommendCategory = 'SQUARE' then 1 else 0 end) as squareCnt`,
        `sum(case when templateItems.recommendCategory = 'SCORE' then 1 else 0 end) as scoreCnt`,
        'sum(1) as totalCnt',
      ])
      .innerJoin(templates, 'template', 'template.id = templateItems.templateId')
      .groupBy('template.id')
      .getRawMany();

    templateComponentInfo.forEach(item => {
      // 갯수로 점수 산출
      let cntScore = 0;
      if (item.totalCnt === widgetComponentInfo.widgetCnt) {
        // 갯수가 같을 때
        cntScore = 100;
      } else if (item.totalCnt > widgetComponentInfo.widgetCnt) {
        // 템플릿의 item이 더 많을 때
        cntScore = 100 - (item.totalCnt - widgetComponentInfo.widgetCnt) * 5;
      } else {
        // 템플릿의 item이 적을 때
        cntScore = 100 - (widgetComponentInfo.widgetCnt - item.totalCnt) * 10;
      }
      item.cntScore = cntScore;

      // 컴포넌트 타입으로 점수 산출
      item.recommendScore = this.calRecommendScore(item, widgetComponentInfo);
    });

    // console.log(templateComponentInfo);
  }

  private async calRecommendScore(templateInfo, widgetInfo) {
    let recommendScore = 0;

    let templateCount = {
      HORIZONTAL: Number(templateInfo.horizontalCnt),
      VERTICAL: Number(templateInfo.verticalCnt),
      SQUARE: Number(templateInfo.squareCnt),
      SCORE: Number(templateInfo.scoreCnt),
      TABLE: 0,
    };

    let widgetCount = {
      HORIZONTAL: Number(widgetInfo.horizontalCnt),
      VERTICAL: Number(widgetInfo.verticalCnt),
      SQUARE: Number(widgetInfo.squareCnt),
      SCORE: Number(widgetInfo.scoreCnt),
      TABLE: Number(widgetInfo.tableCnt),
    };

    // 일치하는 경우 계산 (horizontal, vertical, square, score)
    for (let i = 0; i < Object.keys(templateCount).length; i++) {
      const componentType = Object.keys(templateCount)[i];
      if (widgetCount[componentType] > 0 && templateCount[componentType] > 0) {
        let equalCnt = 0;
        if (templateCount[componentType] >= widgetCount[componentType]) {
          equalCnt = widgetCount[componentType];
        } else if (templateCount[componentType] < widgetCount[componentType]) {
          equalCnt = templateCount[componentType];
        }
        templateCount[componentType] -= equalCnt;
        widgetCount[componentType] -= equalCnt;
        recommendScore += 100 * equalCnt;
      }
    }

    // 남은 것중에 table 100점 짜리 제거
    // restWigetList.map(widget => {
    //   if (widget.componentCategory === ComponentType.TABLE) {
    //     console.log('test');
    //     // componentTypeCount.
    //   }
    // });

    console.log(templateInfo);

    return recommendScore;
  }
}
