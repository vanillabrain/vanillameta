import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { quoteColumn, sourceQuery } from '../ai/dashboard-draft';

@Injectable()
export class BiService {
  private profiles = new Map<number, { version: string; data: any }>();
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
    private readonly dashboards: AiDashboardService,
  ) {}
  async sources(actor: number) {
    const rows = await this.db
      .getRepository(Database)
      .find({ where: { ownerId: this.access.actor(actor) } });
    return rows.map(({ id, name, engine }) => ({ id, name, engine }));
  }
  async profile(id: unknown, actor: number) {
    await this.access.assert('database', id, actor);
    const source = await this.db
      .getRepository(Database)
      .findOne({ where: { id: this.access.id(id) } });
    const version = createHash('sha256')
      .update(JSON.stringify([source.id, source.createdAt, source.updatedAt]))
      .digest('hex');
    const base = {
      sourceId: source.id,
      name: source.name,
      engine: source.engine,
      storedAt: source.createdAt,
      dataVersion: version,
    };
    if (source.engine !== 'duckdb')
      return { ...base, supported: false, status: 'unsupported', columns: [], preview: [] };
    const cached = this.profiles.get(source.id);
    if (cached?.version === version) return cached.data;
    const schema = (await this.connection.queryDuckDB(source.id, 'DESCRIBE uploaded_data')).datas;
    if (!schema.length || schema.length > 128)
      throw new BadRequestException('지원 컬럼 수는 1~128개입니다.');
    const columns = schema.map(row => ({
      name: row.column_name,
      type: row.column_type,
      numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
        row.column_type,
      ),
      temporal: /^(DATE|TIMESTAMP)/i.test(row.column_type),
    }));
    const expressions = ['COUNT(*) AS row_count'];
    columns.forEach((c, i) => {
      expressions.push(`COUNT(*)-COUNT(${quoteColumn(c.name)}) AS null_${i}`);
      if (c.temporal)
        expressions.push(
          `MIN(${quoteColumn(c.name)}) AS min_${i}`,
          `MAX(${quoteColumn(c.name)}) AS max_${i}`,
        );
    });
    const stats = (
      await this.connection.queryDuckDB(
        source.id,
        `SELECT ${expressions.join(', ')} FROM uploaded_data`,
      )
    ).datas[0];
    const preview = (
      await this.connection.queryDuckDB(source.id, 'SELECT * FROM uploaded_data LIMIT 5')
    ).datas;
    const data = {
      ...base,
      supported: true,
      status: 'ready',
      rowCount: String(stats.row_count),
      columns: columns.map((c, i) => ({
        ...c,
        nullCount: String(stats[`null_${i}`]),
        ...(c.temporal ? { min: stats[`min_${i}`], max: stats[`max_${i}`] } : {}),
      })),
      preview,
    };
    if (this.profiles.size >= 50) this.profiles.delete(this.profiles.keys().next().value);
    this.profiles.set(source.id, { version, data });
    return data;
  }
  private text(value: unknown, max: number) {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
      throw new BadRequestException('표시 이름을 확인해 주세요.');
    return value.trim();
  }
  async createMetric(body: any, actor: number) {
    const profile = await this.profile(body?.sourceId, actor);
    if (!profile.supported)
      throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
    const aggregation = body.aggregation;
    if (!Object.values(MetricAggregation).includes(aggregation))
      throw new BadRequestException('지원하지 않는 집계입니다.');
    const label = this.text(body.label, 100);
    const field = profile.columns.find(c => c.name === body.column);
    if (
      aggregation !== 'COUNT' &&
      (!field || (['SUM', 'AVG', 'MIN', 'MAX'].includes(aggregation) && !field.numeric))
    )
      throw new BadRequestException('집계에 맞는 컬럼을 선택해 주세요.');
    if (
      !Number.isInteger(body.decimalPlaces) ||
      body.decimalPlaces < 0 ||
      body.decimalPlaces > 6 ||
      !['plain', 'compact'].includes(body.numberNotation)
    )
      throw new BadRequestException('표시 형식을 확인해 주세요.');
    if (typeof body.unit !== 'string' || body.unit.length > 12)
      throw new BadRequestException('단위를 확인해 주세요.');
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: profile.sourceId,
      tableName: 'uploaded_data',
      label,
      aggregation,
      column: aggregation === 'COUNT' ? '*' : field.name,
      unit: body.unit,
      decimalPlaces: body.decimalPlaces,
      numberNotation: body.numberNotation,
    };
    const repo = this.db.getRepository(Metric);
    const row = await repo.save(
      repo.create({
        name: 'bi_' + randomUUID(),
        databaseId: profile.sourceId,
        tableName: 'uploaded_data',
        aggregation,
        expression: aggregation === 'COUNT' ? 'count_rows' : field.name,
        description: label,
        definition: JSON.stringify(definition),
        useYn: 'Y',
      }),
    );
    return { id: row.id, label, definitionVersion: 1, definition };
  }
  async metrics(sourceId: unknown, actor: number) {
    await this.access.assert('database', sourceId, actor);
    const rows = await this.db
      .getRepository(Metric)
      .find({ where: { databaseId: this.access.id(sourceId), useYn: 'Y' } });
    return rows
      .filter(r => r.definition)
      .map(r => {
        const definition = JSON.parse(r.definition);
        return {
          id: r.id,
          label: definition.label,
          definitionVersion: definition.definitionVersion,
          definition,
        };
      });
  }
  async prepare(body: any, actor: number) {
    const profile = await this.profile(body?.sourceId, actor);
    await this.access.assert('metric', body?.metricId, actor);
    const row = await this.db
      .getRepository(Metric)
      .findOne({ where: { id: this.access.id(body.metricId) } });
    if (!row.definition || row.useYn !== 'Y' || row.databaseId !== profile.sourceId)
      throw new BadRequestException('이 소스의 저장 지표를 선택해 주세요.');
    const definition = JSON.parse(row.definition);
    if (
      !profile.supported ||
      definition.schemaVersion !== 1 ||
      definition.sourceId !== profile.sourceId
    )
      throw new BadRequestException('지표 정의를 확인해 주세요.');
    const field = profile.columns.find(c => c.name === definition.column);
    if (
      definition.aggregation !== 'COUNT' &&
      (!field || (['SUM', 'AVG', 'MIN', 'MAX'].includes(definition.aggregation) && !field.numeric))
    )
      throw new BadRequestException('저장 지표의 컬럼이 변경됐습니다. 새 지표를 만들어 주세요.');
    if (!Object.values(MetricAggregation).includes(definition.aggregation))
      throw new BadRequestException('invalid saved aggregation');
    const expr =
      definition.aggregation === 'COUNT'
        ? 'COUNT(*)'
        : definition.aggregation === 'COUNT_DISTINCT'
        ? `COUNT(DISTINCT ${quoteColumn(definition.column)})`
        : `${definition.aggregation}(${quoteColumn(definition.column)})`;
    if (!['number', 'bar', 'line'].includes(body.chart))
      throw new BadRequestException('차트를 선택해 주세요.');
    const dimension =
      body.chart === 'number' ? undefined : profile.columns.find(c => c.name === body.dimension);
    if (body.chart !== 'number' && !dimension)
      throw new BadRequestException('분류 컬럼을 선택해 주세요.');
    if (body.chart === 'line' && !dimension.temporal)
      throw new BadRequestException('추세 차트에는 날짜 컬럼이 필요합니다.');
    const group = dimension ? quoteColumn(dimension.name) : undefined;
    const sql = `SELECT ${group ? `${group} AS dimension, ` : ''}${expr} AS value FROM source${
      group
        ? ` GROUP BY ${group} ORDER BY ${
            body.chart === 'line' ? 'dimension' : 'value DESC'
          } LIMIT 500`
        : ''
    }`;
    const title = this.text(body.title, 300);
    const draft = {
      databaseId: profile.sourceId,
      title,
      explanation: definition.label,
      widgets: [
        {
          title,
          description: definition.label,
          type:
            body.chart === 'number'
              ? 'BOARD_NUMERIC'
              : body.chart === 'bar'
              ? 'CHART_COLUMN'
              : 'CHART_LINE',
          sql,
          valueField: 'value',
          ...(group ? { categoryField: 'dimension' } : {}),
          decimalPlaces: definition.decimalPlaces,
          suffix: definition.unit ? ' ' + definition.unit : '',
          numberNotation: definition.numberNotation === 'plain' ? 'full' : 'compact',
        },
      ],
    };
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: profile.sourceId,
      dataVersion: profile.dataVersion,
      metricId: row.id,
      definitionVersion: definition.definitionVersion,
      definition,
      dimension: dimension?.name,
      chart: body.chart,
    };
    return { draft, snapshot, profile, definition };
  }
  async preview(body: any, actor: number) {
    const { draft, snapshot, profile, definition } = await this.prepare(body, actor);
    const rows = (
      await this.connection.queryDuckDB(profile.sourceId, sourceQuery(draft.widgets[0].sql, []).sql)
    ).datas;
    return {
      rows,
      metric: definition,
      sourceRevision: profile.dataVersion,
      definitionVersion: snapshot.definitionVersion,
      sqlGenerated: true,
      limit: 500,
      complete: body.chart === 'number',
    };
  }
  async save(body: any, actor: number) {
    const { draft, snapshot } = await this.prepare(body, actor);
    return (await this.dashboards.save({ draft }, actor, snapshot)).data;
  }
}
