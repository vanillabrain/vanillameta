import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
import { TemplateItem } from './entities/template-item.entity';
import { TemplateInfoDto } from './dto/template-info.dto';
import { ItemInfoDto } from './dto/item-info.dto';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { ComponentType } from '../common/enum/component-type.enum';
import { DashboardLayout } from '../dashboard/dto/create-dashboard.dto';

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
      .innerJoin(widgetInfo, 'widget', 'widget.componentId = component.id')
      .setParameter('id', widgets)
      .getRawMany();

    // 템플릿 추천 알고리즘
    const templateComponentInfoList = await this.getRecommendTemplates(widgetList);

    // 결과값 정렬 순서 변경
    const result = templateComponentInfoList.sort(
      (a, b) => b.totalRecommendScore - a.totalRecommendScore,
    );

    return { status: ResponseStatus.SUCCESS, data: result };
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
      .select(['widgetInfo.*', 'component.type as componentType', 'component.category as category'])
      .innerJoin(widgetInfo, 'widgetInfo', 'widgetInfo.componentId = component.id')
      .setParameter('ids', widgets)
      .getRawMany();

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
      layoutList.forEach(item => {
        const itemInfo: ItemInfoDto = new ItemInfoDto(item);
        layout.push(itemInfo);
      });
      templateInfo.layout = layout;
    }

    templateInfo = await this.mappingLayout(widgetList, templateInfo);

    widgetList.forEach((item, i) => {
      item.option = JSON.parse(item.option);
      // templateInfo.widgets.push(item);
      if (templateInfo.layout.length > i && template) templateInfo.layout[i].i = item.id;
    });

    templateInfo.widgets = widgetList;

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

    widgetList.forEach(item => {
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
      .select([
        'template.id as id',
        'template.title as title',
        'template.description as description',
      ])
      .from(Template, 'template')
      .where(`useYn = 'Y'`)
      .getQuery();

    const templateComponentInfoList = await this.templateItemRepository
      .createQueryBuilder('templateItems')
      .select([
        'template.id as id',
        'template.title as title',
        'template.description as description',
        `sum(case when templateItems.recommendCategory = 'HORIZONTAL' then 1 else 0 end) as horizontalCnt`,
        `sum(case when templateItems.recommendCategory = 'VERTICAL' then 1 else 0 end) as verticalCnt`,
        `sum(case when templateItems.recommendCategory = 'SQUARE' then 1 else 0 end) as squareCnt`,
        `sum(case when templateItems.recommendCategory = 'SCORE' then 1 else 0 end) as scoreCnt`,
        'sum(1) as totalCnt',
      ])
      .innerJoin(templates, 'template', 'template.id = templateItems.templateId')
      .groupBy('template.id')
      .addGroupBy('template.title')
      .addGroupBy('template.description')
      .getRawMany();

    for (let i = 0; i < templateComponentInfoList.length; i++) {
      const item = templateComponentInfoList[i];
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
      const scoreItemCnt =
        item.totalCnt > widgetComponentInfo.widgetCnt
          ? widgetComponentInfo.widgetCnt
          : item.totalCnt;
      const recommendScore = await this.calRecommendScore(item, widgetComponentInfo);
      item.recommendScore = recommendScore / scoreItemCnt;

      item.totalRecommendScore = cntScore + recommendScore;
    }
    return templateComponentInfoList;
  }

  /**
   * 템플릿 아이템 추천 점수 산출
   +-------------+----------+--------+------+-----+
   |componentType|horizontal|vertical|square|score|
   +-------------+----------+--------+------+-----+
   |HORIZONTAL   |100       |70      |80    |60   |
   |VERTICAL     |70        |100     |80    |60   |
   |SQUARE       |90        |90      |100   |90   |
   |SCORE        |70        |70      |90    |100  |
   |TABLE        |100       |100     |100   |50   |
   +-------------+----------+--------+------+-----+
   * @param templateInfo
   * @param widgetInfo
   * @private
   */
  private async calRecommendScore(templateInfo, widgetInfo): Promise<number> {
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

    // 1. table -> horizontal, vertical, square
    if (
      widgetCount.TABLE > 0 &&
      (templateCount.HORIZONTAL > 0 || templateCount.VERTICAL > 0 || templateCount.SQUARE > 0)
    ) {
      const templateSum = templateCount.HORIZONTAL + templateCount.VERTICAL + templateCount.SQUARE;
      const mappingCount = widgetCount.TABLE < templateSum ? widgetCount.TABLE : templateSum;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.TABLE -= 1;
        if (templateCount.HORIZONTAL > 0) {
          templateCount.HORIZONTAL -= 1;
        } else if (templateCount.VERTICAL > 0) {
          templateCount.VERTICAL -= 1;
        } else {
          templateCount.SQUARE -= 1;
        }
      }
      recommendScore += 100 * mappingCount;
    }

    // 2. square => any
    if (
      widgetCount.SQUARE > 0 &&
      (templateCount.HORIZONTAL > 0 || templateCount.VERTICAL > 0 || templateCount.SCORE)
    ) {
      const templateSum = templateCount.HORIZONTAL + templateCount.VERTICAL + templateCount.SCORE;
      const mappingCount = widgetCount.SQUARE < templateSum ? widgetCount.SQUARE : templateSum;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.SQUARE -= 1;
        if (templateCount.SCORE > 0) {
          templateCount.SCORE -= 1;
        } else if (templateCount.VERTICAL > 0) {
          templateCount.VERTICAL -= 1;
        } else {
          templateCount.HORIZONTAL -= 1;
        }
      }
      recommendScore += 90 * mappingCount;
    }

    // 3. score => square
    if (widgetCount.SCORE > 0 && templateCount.SQUARE > 0) {
      const templateSum = templateCount.SQUARE;
      const mappingCount = widgetCount.SCORE < templateSum ? widgetCount.SCORE : templateSum;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.SCORE -= 1;
        templateCount.SQUARE -= 1;
      }
      recommendScore += 90 * mappingCount;
    }

    // 4. horizontal, vertical =>  square)
    if ((widgetCount.HORIZONTAL > 0 || widgetCount.VERTICAL) && templateCount.SQUARE > 0) {
      const templateSum = templateCount.SQUARE;
      const horizontalMappingCount =
        widgetCount.HORIZONTAL < templateSum ? widgetCount.HORIZONTAL : templateSum;
      const verticalMappingCount =
        widgetCount.VERTICAL < templateSum - horizontalMappingCount
          ? widgetCount.VERTICAL
          : templateSum - horizontalMappingCount;
      for (let i = 0; i < horizontalMappingCount; i++) {
        widgetCount.HORIZONTAL -= 1;
        templateCount.SQUARE -= 1;
      }
      for (let i = 0; i < verticalMappingCount; i++) {
        widgetCount.VERTICAL -= 1;
        templateCount.SQUARE -= 1;
      }
      recommendScore += 80 * (horizontalMappingCount + verticalMappingCount);
    }

    // 5-1. horizontal => vaertical
    if (widgetCount.HORIZONTAL > 0 && templateCount.VERTICAL > 0) {
      const mappingCount =
        widgetCount.HORIZONTAL < templateCount.VERTICAL
          ? widgetCount.HORIZONTAL
          : templateCount.VERTICAL;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.HORIZONTAL -= 1;
        templateCount.VERTICAL -= 1;
      }
      recommendScore += 70 * mappingCount;
    }

    // 5-2. vertical -> horizontal
    if (widgetCount.VERTICAL > 0 && templateCount.HORIZONTAL > 0) {
      const mappingCount =
        widgetCount.VERTICAL < templateCount.HORIZONTAL
          ? widgetCount.VERTICAL
          : templateCount.HORIZONTAL;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.VERTICAL -= 1;
        templateCount.HORIZONTAL -= 1;
      }
      recommendScore += 70 * mappingCount;
    }

    // 5-3. score -> horizontal, vertical
    if (widgetCount.SCORE > 0 && (templateCount.HORIZONTAL > 0 || templateCount.VERTICAL)) {
      const templateSum = templateCount.HORIZONTAL + templateCount.VERTICAL;
      const mappingCount = widgetCount.SCORE < templateSum ? widgetCount.SCORE : templateSum;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.SCORE -= 1;
        if (templateCount.HORIZONTAL > 0) {
          templateCount.HORIZONTAL -= 1;
        } else {
          templateCount.VERTICAL -= 1;
        }
      }
      recommendScore += 70 * mappingCount;
    }

    // 6. horizontal, viertical => score
    if ((widgetCount.HORIZONTAL > 0 || widgetCount.VERTICAL) && templateCount.SCORE > 0) {
      const templateSum = templateCount.SCORE;
      const horizontalMappingCount =
        widgetCount.HORIZONTAL < templateSum ? widgetCount.HORIZONTAL : templateSum;
      const verticalMappingCount =
        widgetCount.VERTICAL < templateSum - horizontalMappingCount
          ? widgetCount.VERTICAL
          : templateSum - horizontalMappingCount;
      for (let i = 0; i < horizontalMappingCount; i++) {
        widgetCount.HORIZONTAL -= 1;
        templateCount.SCORE -= 1;
      }
      for (let i = 0; i < verticalMappingCount; i++) {
        widgetCount.VERTICAL -= 1;
        templateCount.SCORE -= 1;
      }
      recommendScore += 60 * (horizontalMappingCount + verticalMappingCount);
    }

    // 7. table => score
    if (widgetCount.TABLE > 0 && templateCount.SCORE > 0) {
      const mappingCount =
        widgetCount.TABLE < templateCount.SCORE ? widgetCount.TABLE : templateCount.SCORE;
      for (let i = 0; i < mappingCount; i++) {
        widgetCount.TABLE -= 1;
        templateCount.SCORE -= 1;
      }
      recommendScore += 50 * mappingCount;
    }

    return recommendScore;
  }

  /**
   * layout에 선택한 widget 매핑하기
   * @param widgetList
   * @param templateInfo
   * @private
   */
  private async mappingLayout(widgetList, templateInfo) {
    const templateItemList = templateInfo.layout;
    console.log(templateInfo);

    const templateCount = { HORIZONTAL: 0, VERTICAL: 0, SQUARE: 0, SCORE: 0, TABLE: 0, TOTAL: 0 };

    templateItemList.forEach(templateItem => {
      templateCount[templateItem.category] += 1;
      templateCount.TOTAL += 1;
    });

    const differntWidgetList = [];
    // 같은 타입 넣어주기
    widgetList.forEach(widget => {
      for (let i = 0; i < templateItemList.length; i++) {
        if (!templateItemList[i].i && templateItemList[i].category === widget.category) {
          templateItemList[i].i = widget.id;
          templateCount[widget.category] -= 1;
          templateCount.TOTAL -= 1;
          break;
        } else if (templateCount.TOTAL <= 0 || i === templateItemList.length - 1) {
          differntWidgetList.push(widget);
          break;
        }
      }
    });

    const leastWidgetList = [];
    differntWidgetList.forEach(widget => {
      if (templateCount.TOTAL > 0) {
        //todo:: heeseon::: 이거 순서대로 돌아가는게 아닌거같은데....처음부터 다시해야되나.....
        // 다른 타입 점수 높은거 골라서 넣어주기
        let index = -1;
        if (
          widget.category === ComponentType.TABLE &&
          (templateCount.HORIZONTAL > 0 || templateCount.VERTICAL > 0 || templateCount.SQUARE > 0)
        ) {
          // 1. table -> horizontal, vertical, square : h->v->s 순서로 우선순위가 존재함.
          const horizontalIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.HORIZONTAL,
          );
          const verticalIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.VERTICAL,
          );
          const squareIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.SQUARE,
          );

          if (horizontalIndex >= 0) {
            index = horizontalIndex;
            templateCount[ComponentType.HORIZONTAL] -= 1;
          } else if (verticalIndex >= 0) {
            index = verticalIndex;
            templateCount[ComponentType.VERTICAL] -= 1;
          } else {
            index = squareIndex;
            templateCount[ComponentType.SQUARE] -= 1;
          }
        } else if (
          widget.category === ComponentType.SQUARE &&
          (templateCount.HORIZONTAL > 0 || templateCount.VERTICAL > 0 || templateCount.SCORE > 0)
        ) {
          // 2. square -> any : score->v->h 순서로 우선순위 존재함.
          const scoreIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.SCORE,
          );
          const verticalIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.VERTICAL,
          );
          const horizontalIndex = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.HORIZONTAL,
          );

          if (scoreIndex >= 0) {
            index = scoreIndex;
            templateCount[ComponentType.SCORE] -= 1;
          } else if (verticalIndex >= 0) {
            index = verticalIndex;
            templateCount[ComponentType.VERTICAL] -= 1;
          } else {
            index = horizontalIndex;
            templateCount[ComponentType.HORIZONTAL] -= 1;
          }
        } else if (
          (widget.category === ComponentType.HORIZONTAL ||
            widget.category === ComponentType.VERTICAL ||
            widget.category === ComponentType.SCORE) &&
          templateCount.SQUARE > 0
        ) {
          // 3,4. score, horizontal, vertical -> square
          index = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.SQUARE,
          );
          templateCount[ComponentType.SQUARE] -= 1;
        } else if (
          (widget.category === ComponentType.HORIZONTAL ||
            widget.category === ComponentType.SCORE) &&
          templateCount.VERTICAL > 0
        ) {
          // 5-1. horizontal, score -> vertical
          index = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.VERTICAL,
          );
          templateCount[ComponentType.VERTICAL] -= 1;
        } else if (
          (widget.category === ComponentType.VERTICAL || widget.category === ComponentType.SCORE) &&
          templateCount.HORIZONTAL > 0
        ) {
          // 5-2. vertical, score -> HORIZONTAL
          index = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.HORIZONTAL,
          );
          templateCount[ComponentType.HORIZONTAL] -= 1;
        } else if (
          (widget.category === ComponentType.VERTICAL ||
            widget.category === ComponentType.HORIZONTAL) &&
          templateCount.SCORE > 0
        ) {
          // 6. vertical, horizontal -> SCORE
          index = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.SCORE,
          );
          templateCount[ComponentType.SCORE] -= 1;
        } else if (widget.category === ComponentType.TABLE && templateCount.SCORE > 0) {
          // 7. table -> SCORE
          index = templateItemList.findIndex(
            item => !item.i && item.category === ComponentType.SCORE,
          );
          templateCount[ComponentType.SCORE] -= 1;
        }

        templateItemList[index].i = widget.id;
        templateCount.TOTAL -= 1;
      } else {
        console.log(templateInfo);
        leastWidgetList.push(widget);
        // templateInfo.layout에 새로운 layout object 넣어주기(template에서 넘친 widget 목록)
      }
    });

    leastWidgetList.forEach((leastWidget, index) => {
      const layout = new DashboardLayout();
      layout.x = 0;
      layout.y =
        templateItemList[templateItemList.length - 1].y +
        templateItemList[templateItemList.length - 1].h +
        index * 5;
      layout.w = 5;
      layout.h = 5;
      layout.i = leastWidget.id;
      templateItemList.push(layout);
    });

    return templateInfo;
  }
}
