import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Repository } from 'typeorm';
import { Widget } from './entities/widget.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Component } from '../component/entities/component.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { TableQueryService } from './table-query/table-query.service';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../common/enum/role.enum';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
    @InjectRepository(Database)
    private databaseRepository: Repository<Database>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private tableQueryService: TableQueryService,
  ) {}

  /**
   * 부모 데이터소스 소유자/관리자 검증. userId 미지정(내부 호출)이면 통과.
   * databaseId 가 없는(레거시) 위젯은 관리자만 접근 허용.
   */
  private async assertDatabaseAccess(databaseId: number | null | undefined, userId?: number) {
    if (userId === undefined) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isAdmin = user?.role === UserRole.ADMIN;

    if (databaseId === null || databaseId === undefined) {
      if (isAdmin) return;
      throw new HttpException('forbidden', HttpStatus.FORBIDDEN);
    }

    const database = await this.databaseRepository.findOne({ where: { id: databaseId } });
    if (!database) {
      throw new HttpException('database not found', HttpStatus.NOT_FOUND);
    }
    if (database.ownerId === userId || isAdmin) return;

    throw new HttpException('forbidden', HttpStatus.FORBIDDEN);
  }

  /** 접근 가능한 데이터소스 id 목록. null 이면 필터 없음(관리자/내부 호출). */
  private async accessibleDatabaseIds(userId?: number): Promise<number[] | null> {
    if (userId === undefined) return null;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.role === UserRole.ADMIN) return null;
    const databases = await this.databaseRepository.find({ where: { ownerId: userId } });
    return databases.map(database => database.id);
  }

  /**
   * 위젯 생성
   * @param createWidget
   */
  async create(createWidget: CreateWidgetDto, userId?: number) {
    await this.assertDatabaseAccess(createWidget.databaseId, userId);

    if (
      createWidget.datasetType === DatasetType.TABLE &&
      createWidget.tableName &&
      String(createWidget.tableName).length <= 0
    ) {
      return { status: ResponseStatus.ERROR, message: '필수 입력사항::::선택한 테이블명 ' };
    }

    // 테이블 선택해서 생성할 경우(DatasetType : TABLE), tablequery 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
    if (createWidget.datasetType === DatasetType.TABLE) {
      const res = await this.tableQueryService.create(
        createWidget.databaseId,
        createWidget.tableName,
      );
      createWidget.datasetId = res.id;
    }
    // 데이터셋 선택해서 생성할 경우(DatasetType : DATASET) 그대로 insert
    createWidget.option = JSON.stringify(createWidget.option);

    const saveResult = await this.widgetRepository.save(createWidget);
    saveResult.option = JSON.parse(saveResult.option);
    return { status: ResponseStatus.SUCCESS, data: saveResult };
  }

  /**
   * 위젯 목록 조회
   */
  async findAll(userId?: number) {
    const ids = await this.accessibleDatabaseIds(userId);
    if (ids !== null && ids.length === 0) {
      return { status: ResponseStatus.SUCCESS, data: [] };
    }

    const queryBuilder = this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoin(Component, 'component', 'component.id = widget.componentId')
      .select([
        'widget.*',
        'component.type as componentType',
        'component.icon as icon',
        'component.title as componentTitle',
        'component.description as componentDescription',
      ]);

    if (ids !== null) {
      queryBuilder.andWhere('widget.databaseId IN (:...ids)', { ids });
    }

    const find_all = await queryBuilder
      .orderBy('widget.updatedAt', 'DESC')
      .addOrderBy('widget.title')
      .getRawMany();

    find_all.forEach(el => {
      el.option = JSON.parse(el.option);
    });
    return { status: ResponseStatus.SUCCESS, data: find_all };
  }

  async findOne(id: number, userId?: number) {
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
      .subQuery()
      .select(['widget.*'])
      .from(Widget, 'widget')
      .where('id=:id')
      .getQuery();

    const find_widget = await this.componentRepository
      .createQueryBuilder('component')
      .select([
        'widgetInfo.*',
        'component.type as componentType',
        'component.icon as icon',
        'component.title as componentTitle',
        'component.description as componentDescription',
      ])
      .innerJoin(widgetInfo, 'widgetInfo', 'widgetInfo.componentId = component.id')
      .setParameter('id', id)
      .getRawOne();

    let resultObj = {};
    if (!find_widget)
      resultObj = { status: ResponseStatus.ERROR, message: `${id} 위젯이 존재하지 않습니다.` };
    else {
      await this.assertDatabaseAccess(find_widget.databaseId, userId);
      find_widget.option = JSON.parse(find_widget.option);
      resultObj = { status: ResponseStatus.SUCCESS, data: find_widget };
    }
    return resultObj;
  }

  /**
   * 위젯 수정
   * @param id
   * @param updateWidget
   */
  async update(id: number, updateWidget: UpdateWidgetDto, userId?: number) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });
    if (!find_widget) {
      return { status: ResponseStatus.ERROR, message: `${id} 위젯이 존재하지 않습니다.` };
    } else {
      await this.assertDatabaseAccess(find_widget.databaseId, userId);
      // 변경 가능한 항목 넣어주기
      find_widget.option = JSON.stringify(updateWidget.option);
      if (updateWidget.delYn) {
        find_widget.delYn = updateWidget.delYn;
      }
      if (updateWidget.title) {
        find_widget.title = updateWidget.title;
      }
      if (updateWidget.componentId) {
        find_widget.componentId = updateWidget.componentId;
      }

      const saveResult = await this.widgetRepository.save(find_widget);
      saveResult.option = JSON.parse(saveResult.option);

      return { status: ResponseStatus.SUCCESS, data: saveResult };
    }
  }

  /**
   * widget 삭제
   * @param id
   */
  async remove(id: number, userId?: number) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });

    if (!find_widget) {
      return { status: ResponseStatus.ERROR, message: 'No exist' };
    } else {
      await this.assertDatabaseAccess(find_widget.databaseId, userId);
      // dataset이 아닐경우
      if (find_widget.datasetType === DatasetType.TABLE)
        await this.tableQueryService.remove(find_widget.datasetId);
      await this.widgetRepository.delete(id);
      return { status: ResponseStatus.SUCCESS, message: `This action removes a #${id} widget` };
    }
  }
}
