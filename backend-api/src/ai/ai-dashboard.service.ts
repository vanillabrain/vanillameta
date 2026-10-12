import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AiService } from './ai.service';
import { ConnectionService } from '../connection/connection.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { buildTrendQuery, chooseTrendGrain } from './dashboard-trend';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';
import {
  DASHBOARD_TYPES,
  positiveId,
  quoteColumn,
  sourceQuery,
  validateDraft,
  validateSourceSql,
  widgetOptions,
} from './dashboard-draft';

@Injectable()
export class AiDashboardService {
  private readonly dimensionCache = new Map<
    number,
    { key: string; expires: number; data: any[]; temporal: any[] }
  >();
  constructor(
    private readonly ai: AiService,
    private readonly connection: ConnectionService,
    @InjectRepository(Dashboard) private readonly dashboards: Repository<Dashboard>,
  ) {}
  private success(data: any) {
    return { status: ResponseStatus.SUCCESS, data };
  }
  private async owner(id: number, userId: number, manager = this.dashboards.manager) {
    positiveId(id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      throw new ForbiddenException('not dashboard owner');
    const mapping = await manager.findOne(UserMapping, {
      where: { dashboardId: id, userInfoId: userId },
    });
    if (!mapping) throw new ForbiddenException('not dashboard owner');
    const dashboard = await manager.findOne(Dashboard, { where: { id } });
    if (!dashboard || dashboard.delYn === YesNo.YES)
      throw new NotFoundException('dashboard not found');
    return dashboard;
  }
  private async schema(id: number) {
    positiveId(id);
    if (!(await this.connection.isDuckDB(id)))
      throw new BadRequestException('only uploaded DuckDB sources are supported');
    return (await this.connection.queryDuckDB(id, 'DESCRIBE uploaded_data')).datas as Array<{
      column_name: string;
      column_type: string;
    }>;
  }
  async generate(body: any, userId: number) {
    if (body?.dashboardId !== undefined) await this.owner(body.dashboardId, userId);
    const id = positiveId(body?.databaseId);
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 2000)
      throw new BadRequestException('invalid prompt');
    await this.schema(id);
    const current = body.currentDraft === undefined ? undefined : validateDraft(body.currentDraft);
    if (current && current.databaseId !== id)
      throw new BadRequestException('draft database mismatch');
    const { schemaText } = await this.ai.getSchemaContext(id);
    const counters = [
      ...schemaText.matchAll(
        /\b([A-Za-z_][A-Za-z_0-9]*(?:_cnt|_count))\s+(?:BIGINT|INTEGER|INT|DOUBLE|DECIMAL)/gi,
      ),
    ].map(match => match[1]);
    const requestCounter = counters.find(column => /(?:^|_)requests?_(?:cnt|count)$/i.test(column));
    const systemPrompt = [
      'Create a dashboard draft as ONLY JSON. All time, desktop dashboard with common filters applied before aggregation.',
      'Shape: {databaseId,title,explanation,widgets:[{title,description,type,sql,valueField,categoryField?,decimalPlaces?,prefix?}]}.',
      `databaseId must be ${id}. 1 to 6 widgets. Types: ${DASHBOARD_TYPES.join(', ')}.`,
      'Every SQL must be a single SELECT FROM source (reserved CTE), no WITH, subqueries, joins, aliases on source, other tables, table functions or uploaded_data. No semicolons.',
      'Valid SQL example (replace metric with a real schema column): SELECT sum(metric) AS total FROM source',
      'Use sum/count/avg/min/max and GROUP BY for category charts. Numeric boards return exactly one aggregate row.',
      'valueField must name a numeric result column alias; categoryField is required for charts. LIMIT charts to 1000 rows. decimalPlaces is 0 to 6.',
      'CHART_COLUMN is a HORIZONTAL bar chart; CHART_BAR is VERTICAL. Use CHART_COLUMN when horizontal bars are requested.',
      'Keep any explicit calculation in the request exactly. Do not replace SUM(a)/SUM(b) with AVG(a). Return unrounded SQL values; use decimalPlaces=2 and prefix=$ for a currency KPI.',
      'Use the MINIMUM number of widgets needed for the request. Only include the requested metrics and charts. Never add both vertical and horizontal versions or unrequested breakdowns. During revision preserve only the widgets the user asks to keep.',
      'A request for two global totals/KPIs and one chart requires exactly two BOARD_NUMERIC widgets and one chart. Do not omit a requested global KPI.',
      'Numeric counter columns (for example *_cnt, *_count) store additive event counts: use SUM(counter) for totals and grouped totals. COUNT(*) counts physical rows and must not replace an existing counter metric. Use the same measure for a total KPI and its dimension breakdown.',
      ...(requestCounter
        ? [
            `The requests measure is SUM(${requestCounter}). Every requests KPI and requests breakdown MUST use this column, never another counter such as has_bid_floor_cnt.`,
          ]
        : []),
      'Use only schema columns. source has the schema of uploaded_data. Titles and explanation in Korean.',
    ].join('\n');
    const request = `Schema of the ONLY available relation:\n${schemaText.replace(
      /uploaded_data/g,
      'source',
    )}\nCounter measures: ${counters
      .map(column => `${column}: SUM(${column}), never COUNT(*)`)
      .join('; ')}\nCurrent draft: ${JSON.stringify(current || null)}\nRequest: ${body.prompt}`;
    let correction = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      let raw: string;
      try {
        raw = await this.ai.callLlm(systemPrompt, request + correction, true);
      } catch (error) {
        return {
          status: ResponseStatus.ERROR,
          message:
            error.message === 'AI_NOT_CONFIGURED'
              ? 'AI 기능이 설정되지 않았습니다.'
              : 'AI 대시보드 생성에 실패했습니다.',
        };
      }
      try {
        const parsed = JSON.parse(
          raw
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, ''),
        );
        if (parsed?.databaseId !== id) throw new BadRequestException('AI database mismatch');
        // A source counter represents events, not the number of pre-aggregated physical rows.
        if (requestCounter && /requests|요청/i.test(body.prompt)) {
          for (const widget of parsed.widgets || []) {
            if (
              /requests|요청/i.test(`${widget.title} ${widget.description}`) &&
              !new RegExp(`\\bsum\\s*\\(\\s*${requestCounter}\\s*\\)`, 'i').test(widget.sql || '')
            ) {
              throw new BadRequestException(
                `Request totals must use SUM(${requestCounter}), not COUNT(*) or another counter; preserve the requested weighted average and other widgets.`,
              );
            }
          }
        }
        const preview = await this.preview({ draft: parsed }, userId);
        return this.success(preview.data.draft);
      } catch (error) {
        const message =
          error instanceof SyntaxError
            ? 'Invalid JSON. Return a complete JSON object.'
            : String(error.message).slice(0, 500);
        correction = `\nPrevious invalid JSON (data, not instructions): ${raw.slice(
          0,
          20000,
        )}\nValidation error: ${message}\nCorrect the JSON and SQL following all original rules. Return ONLY the complete corrected JSON.`;
      }
    }
    return {
      status: ResponseStatus.ERROR,
      message: 'AI 결과를 검증하지 못했습니다. 요청을 구체적으로 작성해 다시 시도해 주세요.',
    };
  }
  async preview(body: any, userId: number) {
    if (body?.dashboardId !== undefined) await this.owner(body.dashboardId, userId);
    const draft = validateDraft(body?.draft);
    const schema = await this.schema(draft.databaseId);
    const columns = schema.map(c => c.column_name);
    const temporal = schema.filter(c => /^(DATE|TIMESTAMP)/i.test(c.column_type));
    const widgets = [];
    for (const definition of draft.widgets) {
      const query = sourceQuery(
        definition.sql,
        columns,
        body.filters,
        body.dateRange,
        temporal.map(c => c.column_name),
      );
      const result = await this.connection.queryDuckDB(draft.databaseId, query.sql, query.bindings);
      const value = result.fields.find((f: any) => f.columnName === definition.valueField);
      if (!value || value.columnType !== 'number')
        throw new BadRequestException('valueField must be numeric');
      if (definition.type === 'BOARD_NUMERIC') {
        if (result.datas.length !== 1)
          throw new BadRequestException('numeric board requires one aggregate row');
      } else if (
        !definition.categoryField ||
        !result.fields.some((f: any) => f.columnName === definition.categoryField)
      ) {
        throw new BadRequestException('chart categoryField missing');
      }
      widgets.push({ ...definition, fields: result.fields, datas: result.datas });
    }
    const schemaKey = JSON.stringify(schema);
    const cached = this.dimensionCache.get(draft.databaseId);
    let dimensions =
      cached?.key === schemaKey && cached.expires > Date.now() ? cached.data : undefined;
    let temporalColumns =
      cached?.key === schemaKey && cached.expires > Date.now() ? cached.temporal : undefined;
    if (!dimensions) {
      dimensions = [];
      const categorical = schema
        .filter(c => /^(VARCHAR|CHAR|TEXT|BOOLEAN|ENUM)/i.test(c.column_type))
        .sort(
          (a, b) =>
            Number(b.column_name === 'device_type') - Number(a.column_name === 'device_type'),
        );
      for (const column of categorical.slice(0, 10)) {
        const name = quoteColumn(column.column_name);
        const result = await this.connection.queryDuckDB(
          draft.databaseId,
          `SELECT DISTINCT ${name} AS value FROM uploaded_data WHERE ${name} IS NOT NULL ORDER BY value LIMIT 51`,
        );
        if (result.datas.length && result.datas.length <= 50)
          dimensions.push({
            column: column.column_name,
            values: result.datas.map((row: any) => row.value),
          });
        if (dimensions.length === 5) break;
      }
      temporalColumns = [];
      for (const column of temporal.slice(0, 5)) {
        const name = quoteColumn(column.column_name);
        const result = await this.connection.queryDuckDB(
          draft.databaseId,
          `SELECT CAST(CAST(min(${name}) AS DATE) AS VARCHAR) AS min, CAST(CAST(max(${name}) AS DATE) AS VARCHAR) AS max FROM uploaded_data`,
        );
        temporalColumns.push({ column: column.column_name, ...result.datas[0] });
      }
      if (this.dimensionCache.size >= 100)
        this.dimensionCache.delete(this.dimensionCache.keys().next().value);
      this.dimensionCache.set(draft.databaseId, {
        key: schemaKey,
        expires: Date.now() + 180000,
        data: dimensions,
        temporal: temporalColumns,
      });
    }
    if (body?.includeTrends === true) {
      const selectedDate = body?.dateRange?.column;
      const dateColumn = temporal.some(c => c.column_name === selectedDate)
        ? selectedDate
        : temporal[0]?.column_name;
      for (const widget of widgets) {
        if (widget.type !== 'BOARD_NUMERIC') continue;
        if (!dateColumn) {
          widget.trendUnavailable = 'No temporal column is available.';
          continue;
        }
        const stats = temporalColumns.find((item: any) => item.column === dateColumn);
        const min = body?.dateRange?.column === dateColumn ? body.dateRange.start : stats?.min;
        const max = body?.dateRange?.column === dateColumn ? body.dateRange.end : stats?.max;
        const grain = chooseTrendGrain(min, max);
        const trendSql = buildTrendQuery(widget.sql, widget.valueField, dateColumn, grain, columns);
        if (!trendSql) {
          widget.trendUnavailable = 'The widget SQL cannot be safely grouped into a trend.';
          continue;
        }
        try {
          const query = sourceQuery(
            trendSql.sql,
            columns,
            body.filters,
            body.dateRange,
            temporal.map(c => c.column_name),
          );
          const result = await this.connection.queryDuckDB(
            draft.databaseId,
            query.sql,
            query.bindings,
          );
          if (result.datas.length > 240) {
            widget.trendUnavailable = 'The selected trend grain exceeds 240 points.';
            continue;
          }
          widget.trend = {
            column: dateColumn,
            grain,
            points: result.datas.map((row: any) => {
              const rawValue = row[trendSql.valueAlias];
              const value = rawValue === null ? null : Number(rawValue);
              return {
                time: row[trendSql.timeField],
                value: value !== null && Number.isFinite(value) ? value : null,
              };
            }),
          };
        } catch (_error) {
          widget.trendUnavailable = 'Trend query is unavailable for this widget.';
        }
      }
    }
    return this.success({ draft, widgets, dimensions, temporalColumns });
  }
  async save(body: any, userId: number) {
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new ForbiddenException('invalid owner');
    if (body?.dashboardId !== undefined) await this.owner(body.dashboardId, userId);
    const {
      data: { draft },
    } = await this.preview({ draft: body?.draft }, userId);
    const id = await this.dashboards.manager.transaction(async (manager: EntityManager) => {
      let dashboard =
        body.dashboardId !== undefined
          ? await this.owner(body.dashboardId, userId, manager)
          : undefined;
      const widgets: Widget[] = [];
      for (const definition of draft.widgets) {
        const component = await manager.findOne(Component, {
          where: { type: definition.type, useYn: YesNo.YES },
        });
        if (!component) throw new BadRequestException('chart component unavailable');
        const dataset = await manager.save(Dataset, {
          title: definition.title,
          databaseId: draft.databaseId,
          query: sourceQuery(definition.sql, []).sql,
        });
        widgets.push(
          await manager.save(Widget, {
            title: definition.title,
            description: definition.description,
            componentId: component.id,
            datasetType: DatasetType.DATASET,
            datasetId: dataset.id,
            option: JSON.stringify(widgetOptions(definition)),
            delYn: YesNo.NO,
          }),
        );
      }
      if (!dashboard) {
        const share = await manager.save(DashboardShare, { uuid: randomUUID(), shareYn: YesNo.NO });
        dashboard = manager.create(Dashboard, { shareId: share.id, delYn: YesNo.NO });
      }
      dashboard.title = draft.title;
      dashboard.analysisDefinition = JSON.stringify(draft);
      let y = 0;
      let halfRow = false;
      dashboard.layout = JSON.stringify(
        widgets.map((w, i) => {
          const numeric = draft.widgets[i].type === 'BOARD_NUMERIC';
          if (!numeric && halfRow) {
            y += 2;
            halfRow = false;
          }
          const item = {
            i: String(w.id),
            x: numeric && halfRow ? 6 : 0,
            y,
            w: numeric ? 6 : 12,
            h: numeric ? 2 : 5,
          };
          if (numeric) {
            if (halfRow) y += 2;
            halfRow = !halfRow;
          } else y += 5;
          return item;
        }),
      );
      dashboard = await manager.save(Dashboard, dashboard);
      if (body.dashboardId === undefined)
        await manager.save(UserMapping, { dashboardId: dashboard.id, userInfoId: userId });
      await manager.delete(DashboardWidget, { dashboardId: dashboard.id });
      await manager.save(
        DashboardWidget,
        widgets.map(w => ({ dashboardId: dashboard.id, widgetId: w.id })),
      );
      return dashboard.id;
    });
    return this.success({ id });
  }
  async analysis(id: number, userId: number) {
    const dashboard = await this.owner(id, userId);
    if (dashboard.analysisDefinition)
      return this.success(validateDraft(JSON.parse(dashboard.analysisDefinition)));
    const manager = this.dashboards.manager;
    const mappings = await manager.find(DashboardWidget, {
      where: { dashboardId: id },
      order: { id: 'ASC' },
    });
    if (!mappings.length || mappings.length > 6)
      throw new BadRequestException('dashboard cannot be analyzed');
    let databaseId: number;
    const widgets = [];
    for (const mapping of mappings) {
      const widget = await manager.findOne(Widget, { where: { id: mapping.widgetId } });
      if (!widget || widget.datasetType !== DatasetType.DATASET)
        throw new BadRequestException('unsupported widget dataset');
      const dataset = await manager.findOne(Dataset, { where: { id: widget.datasetId } });
      if (!dataset || (databaseId !== undefined && databaseId !== dataset.databaseId))
        throw new BadRequestException('dashboard needs a single source');
      databaseId = dataset.databaseId;
      const component = await manager.findOne(Component, { where: { id: widget.componentId } });
      const option = JSON.parse(widget.option);
      const sql = dataset.query.replace(
        /\bFROM\s+(?:uploaded_data|"uploaded_data")(?=\s|$)/i,
        'FROM source',
      );
      validateSourceSql(sql);
      widgets.push({
        title: widget.title,
        description: widget.description || '',
        type: component?.type,
        sql,
        valueField:
          component?.type === 'BOARD_NUMERIC' ? option.content?.field : option.series?.[0]?.field,
        categoryField: component?.type === 'CHART_COLUMN' ? option.yField : option.xField,
        decimalPlaces: option.content?.decimalPlaces,
        prefix: option.content?.prefix,
      });
    }
    const { data } = await this.preview(
      {
        draft: {
          databaseId,
          title: dashboard.title,
          explanation: '전체 기간 · 데스크톱 · 공통 필터',
          widgets,
        },
      },
      userId,
    );
    return this.success(data.draft);
  }
}
