import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Component } from '../component/entities/component.entity';
import { ConnectionService } from '../connection/connection.service';
import { DashboardWidgetService } from '../dashboard/dashboard-widget/dashboard-widget.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DatabaseService } from '../database/database.service';
import { assertReadOnlyQuery, assertSafeIdentifier } from '../utils/query-guard.util';
import { RecommendChartDto } from './dto/recommend-chart.dto';
import { YesNo } from '../common/enum/yn.enum';
import { CODEX_MODEL } from './coding-agent';
import { generateText } from 'ai';
import { codexSdkModel } from './codex-sdk-model';

const MAX_SCHEMA_TABLES = 25;
const MAX_PROMPT_LENGTH = 2000;

const DIALECT_NAMES: Record<string, string> = {
  mysql2: 'MySQL',
  pg: 'PostgreSQL',
  sqlite3: 'SQLite',
  mssql: 'Microsoft SQL Server',
  oracledb: 'Oracle',
  cockroachdb: 'CockroachDB',
  bigquery: 'BigQuery',
  snowflake: 'Snowflake',
};

@Injectable()
export class AiService {
  constructor(
    private readonly connectionService: ConnectionService,
    private readonly databaseService: DatabaseService,
    @InjectRepository(Component) private componentRepository: Repository<Component>,
    @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
    private readonly dashboardWidgetService: DashboardWidgetService,
    @InjectRepository(UserMapping) private userMappingRepository: Repository<UserMapping>,
  ) {}

  private isConfigured(): boolean {
    return process.env.AI_PROVIDER === 'codex' || !!process.env.AI_API_KEY;
  }

  private providerMetadata() {
    return {
      provider: process.env.AI_PROVIDER === 'codex' ? 'codex' : 'api',
      // Requested model only: CLI output does not attest to the model actually used.
      requestedModel:
        process.env.AI_PROVIDER === 'codex' ? CODEX_MODEL : process.env.AI_MODEL || 'gpt-4o-mini',
    };
  }

  /** Opt-in Codex CLI, otherwise the existing OpenAI-compatible API. */
  async callLlm(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
    if (process.env.AI_PROVIDER === 'codex') {
      const result = await generateText({
        model: codexSdkModel(jsonMode),
        system: systemPrompt,
        prompt: userPrompt,
        maxRetries: 0,
      });
      return result.text;
    }
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error('AI_NOT_CONFIGURED');
    }
    const baseUrl = (process.env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    );
    const model = process.env.AI_MODEL || 'gpt-4o-mini';

    const controller = new AbortController();
    const configuredTimeout = Number(process.env.AI_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? Math.min(configuredTimeout, 180000)
        : 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          ...(jsonMode ? { response_format: { type: 'json_object' }, max_tokens: 4096 } : {}),
          ...(process.env.AI_REASONING_EFFORT
            ? { reasoning_effort: process.env.AI_REASONING_EFFORT }
            : {}),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(`LLM API error ${response.status}: ${body.slice(0, 500)}`);
      throw new Error(`LLM_API_ERROR_${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM_EMPTY_RESPONSE');
    }
    return content;
  }

  /**
   * 대상 데이터베이스의 테이블/컬럼 스키마를 프롬프트 컨텍스트로 구성
   */
  async getSchemaContext(databaseId: number): Promise<{ schemaText: string; dialect: string }> {
    if (await this.connectionService.isDuckDB?.(databaseId)) {
      const schema = await this.connectionService.queryDuckDB(databaseId, 'DESCRIBE uploaded_data');
      const columns = schema.datas
        .map((column: any) => `${column.column_name} ${column.column_type}`)
        .join(', ');
      return { dialect: 'DuckDB', schemaText: `- uploaded_data(${columns})` };
    }
    const knex = await this.connectionService.getKnex(databaseId);
    const clientName =
      typeof knex.client.config.client === 'string' ? knex.client.config.client : 'unknown';
    const dialect = DIALECT_NAMES[clientName] || 'SQL';

    const dbDetail = await this.databaseService.findOne(databaseId);
    const tables: { tableName: string }[] = dbDetail?.data?.tables ?? [];

    const lines: string[] = [];
    for (const table of tables.slice(0, MAX_SCHEMA_TABLES)) {
      try {
        assertSafeIdentifier(table.tableName);
        const columnInfo = await knex(table.tableName).columnInfo();
        const cols = Object.entries(columnInfo)
          .map(([name, info]: [string, any]) => `${name} ${info.type || ''}`.trim())
          .join(', ');
        lines.push(`- ${table.tableName}(${cols})`);
      } catch (e) {
        // 컬럼 조회 불가 테이블은 이름만 포함
        lines.push(`- ${table.tableName}`);
      }
    }

    return { schemaText: lines.join('\n'), dialect };
  }

  /**
   * 자연어 요구사항 → SQL 생성. 생성된 SQL은 read-only 가드를 통과해야 반환됨.
   */
  async textToSql(databaseId: number, prompt: string) {
    if (!Number.isInteger(+databaseId) || +databaseId <= 0) {
      return { status: ResponseStatus.ERROR, message: 'invalid databaseId' };
    }
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
      return { status: ResponseStatus.ERROR, message: 'invalid prompt' };
    }
    if (!this.isConfigured()) {
      return {
        status: ResponseStatus.ERROR,
        message:
          'AI 기능이 설정되지 않았습니다. AI_API_KEY 또는 AI_PROVIDER=codex(설치된 CLI와 ChatGPT 로그인 필요)를 설정해 주세요.',
      };
    }

    let schemaText: string;
    let dialect: string;
    try {
      ({ schemaText, dialect } = await this.getSchemaContext(+databaseId));
    } catch (e) {
      console.error(e);
      return { status: ResponseStatus.ERROR, message: '데이터베이스 스키마 조회에 실패했습니다.' };
    }

    const systemPrompt = [
      `You are a SQL query generator for a BI tool. The target dialect is ${dialect}.`,
      'Rules:',
      '- Output ONLY a single SQL query. No markdown fences, no explanation.',
      '- Only generate read-only SELECT (or WITH ... SELECT) queries.',
      '- Never generate INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE or multiple statements.',
      '- Use only the tables and columns from the provided schema.',
      '- Limit results to 1000 rows unless the user asks otherwise.',
    ].join('\n');

    const userPrompt = `Database schema:\n${schemaText || '(empty)'}\n\nRequest: ${prompt.trim()}`;

    try {
      const raw = await this.callLlm(systemPrompt, userPrompt);
      const sql = raw
        .trim()
        .replace(/^```(?:sql)?\s*/i, '')
        .replace(/\s*```$/, '')
        .replace(/;\s*$/, '');
      assertReadOnlyQuery(sql); // 생성 SQL도 동일 가드 적용
      return { status: ResponseStatus.SUCCESS, data: { sql, ai: this.providerMetadata() } };
    } catch (e) {
      if (e.message === 'AI_NOT_CONFIGURED') {
        return {
          status: ResponseStatus.ERROR,
          message:
            'AI 기능이 설정되지 않았습니다. AI_API_KEY 또는 AI_PROVIDER=codex(설치된 CLI와 ChatGPT 로그인 필요)를 설정해 주세요.',
        };
      }
      console.error(e);
      return {
        status: ResponseStatus.ERROR,
        message: e?.message?.startsWith('LLM_')
          ? 'AI 쿼리 생성 중 오류가 발생했습니다.'
          : `생성된 쿼리가 안전하지 않습니다: ${e.message}`,
      };
    }
  }

  /**
   * 데이터셋 스키마 + 샘플 기반 차트 타입 추천.
   * LLM 응답은 등록된 component 목록 안에서만 검증/반환된다.
   */
  async recommendChart(dto: RecommendChartDto) {
    if (!this.isConfigured()) {
      return {
        status: ResponseStatus.ERROR,
        message:
          'AI 기능이 설정되지 않았습니다. AI_API_KEY 또는 AI_PROVIDER=codex(설치된 CLI와 ChatGPT 로그인 필요)를 설정해 주세요.',
      };
    }

    const dataResult = await this.databaseService.findData(
      dto.datasetType,
      +dto.databaseId,
      dto.datasetId ? +dto.datasetId : undefined,
      dto.tableName,
    );
    if (dataResult.status === ResponseStatus.ERROR) {
      return { status: ResponseStatus.ERROR, message: dataResult.message };
    }

    const fields = (dataResult as any).data?.fields ?? [];
    const sampleRows = ((dataResult as any).data?.datas ?? []).slice(0, 5);
    if (fields.length === 0) {
      return { status: ResponseStatus.ERROR, message: '추천할 데이터가 없습니다.' };
    }

    const components = await this.componentRepository.find({ where: { useYn: YesNo.YES } });
    if (components.length === 0) {
      return { status: ResponseStatus.ERROR, message: '등록된 차트 컴포넌트가 없습니다.' };
    }

    const componentListText = components
      .map(c => `- ${c.type}: ${c.title}${c.description ? ` (${c.description})` : ''}`)
      .join('\n');
    const fieldText = fields.map((f: any) => `${f.columnName}(${f.columnType})`).join(', ');

    const systemPrompt = [
      'You are a data visualization expert for a BI tool.',
      'Pick the single best chart type for the given dataset fields and sample rows.',
      'Answer ONLY with a JSON object: {"type": "<chart type code>", "reason": "<one short sentence in Korean>"}',
      'The type must be one of the provided chart type codes.',
    ].join('\n');

    const userPrompt = [
      `Fields: ${fieldText}`,
      `Sample rows: ${JSON.stringify(sampleRows).slice(0, 2000)}`,
      `Available chart types:\n${componentListText}`,
    ].join('\n\n');

    try {
      const raw = await this.callLlm(systemPrompt, userPrompt);
      const parsed = JSON.parse(
        raw
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, ''),
      );
      const component = components.find(c => c.type === parsed.type);
      if (!component) {
        return { status: ResponseStatus.ERROR, message: 'AI 추천 결과가 유효하지 않습니다.' };
      }
      return {
        status: ResponseStatus.SUCCESS,
        data: { component, reason: parsed.reason || '', ai: this.providerMetadata() },
      };
    } catch (e) {
      console.error(e);
      return { status: ResponseStatus.ERROR, message: 'AI 차트 추천 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 대시보드의 위젯 데이터를 샘플링해 LLM으로 한국어 인사이트를 생성한다.
   * 위젯별로 최대 6개까지 데이터를 조회하고, 실패한 위젯은 건너뛴다.
   */
  async dashboardInsight(dashboardId: number, requesterId: number) {
    if (!Number.isInteger(+dashboardId) || +dashboardId <= 0) {
      return { status: ResponseStatus.ERROR, message: 'invalid dashboardId' };
    }
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      throw new ForbiddenException('not dashboard owner');
    }
    const mapping = await this.userMappingRepository.findOne({
      where: { dashboardId: +dashboardId, userInfoId: requesterId },
    });
    if (!mapping) throw new ForbiddenException('not dashboard owner');
    if (!this.isConfigured()) {
      return {
        status: ResponseStatus.ERROR,
        message:
          'AI 기능이 설정되지 않았습니다. AI_API_KEY 또는 AI_PROVIDER=codex(설치된 CLI와 ChatGPT 로그인 필요)를 설정해 주세요.',
      };
    }

    const dashboard = await this.dashboardRepository.findOne({ where: { id: +dashboardId } });
    if (!dashboard) {
      return { status: ResponseStatus.ERROR, message: '대시보드를 찾을 수 없습니다.' };
    }

    const widgets = await this.dashboardWidgetService.findWidgets(+dashboardId);
    if (!widgets || widgets.length === 0) {
      return { status: ResponseStatus.ERROR, message: '분석할 위젯이 없습니다.' };
    }

    const contexts: string[] = [];
    for (const widget of widgets.slice(0, 6)) {
      try {
        const dataResult = await this.databaseService.findData(
          widget.datasetType,
          null,
          widget.datasetId,
          widget.tableName,
        );
        if (dataResult.status !== ResponseStatus.ERROR) {
          const fields = ((dataResult as any).data?.fields ?? [])
            .map((f: any) => `${f.columnName}(${f.columnType})`)
            .join(', ');
          const rows = ((dataResult as any).data?.datas ?? []).slice(0, 3);
          contexts.push(
            `Widget "${widget.title || widget.componentType}" (${widget.componentType})\n` +
              `Fields: ${fields}\nSample: ${JSON.stringify(rows).slice(0, 1000)}`,
          );
        }
      } catch (e) {
        // 데이터 조회 실패 위젯은 스킵
        console.warn(`insight widget ${widget.id} skipped: ${e.message}`);
      }
    }

    if (contexts.length === 0) {
      return { status: ResponseStatus.ERROR, message: '위젯 데이터를 조회할 수 없습니다.' };
    }

    const systemPrompt = [
      'You are a BI analyst. Given dashboard widget data samples, produce concise insights in Korean.',
      'Rules:',
      '- 3~6개의 bullet point로 작성 (- 로 시작)',
      '- 각 bullet은 데이터에서 관찰되는 구체적 패턴/수치를 포함',
      '- 마지막에 1문장 총평 추가',
      '- 데이터가 부족하면 추측하지 말 것',
    ].join('\n');

    const userPrompt = `Dashboard: "${dashboard.title}"\n\n${contexts.join('\n\n')}`;

    try {
      const insight = await this.callLlm(systemPrompt, userPrompt);
      return {
        status: ResponseStatus.SUCCESS,
        data: { insight: insight.trim(), ai: this.providerMetadata() },
      };
    } catch (e) {
      console.error(e);
      return { status: ResponseStatus.ERROR, message: 'AI 인사이트 생성 중 오류가 발생했습니다.' };
    }
  }
}
