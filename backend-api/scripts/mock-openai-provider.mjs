#!/usr/bin/env node
/**
 * Mock OpenAI-compatible chat-completions provider for end-to-end checks of VanillaMeta's AI flows.
 *
 * Plain Node ESM, no dependencies, so it can run alone in a container (see README-mock-provider.md).
 *
 * Endpoints
 *   POST /v1/chat/completions   OpenAI chat format; answers by feature (recognised from the system prompt)
 *   GET  /health                liveness and the current mode
 *   POST /__control             switch behaviour at runtime (JSON body, every field optional)
 *   GET  /__calls               recorded calls (feature, model, sizes, status, aborted, ...)
 *
 * Modes: normal | delay | stall-silent | http-error | bad-json | truncated | no-usage | slow-then-ok
 *
 * The `normal` answers are built to pass the real validators of the backend. The builders below are
 * pure functions (no server) so that backend-api/src/dashboard-studio/mock-provider-contract.spec.ts can
 * load this exact file and feed its answers through the real validators.
 */
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODES = [
  'normal',
  'delay',
  'stall-silent',
  'http-error',
  'bad-json',
  'truncated',
  'no-usage',
  'slow-then-ok',
];

/** Distinctive system-prompt fragments of the backend features. Order does not matter; they are unique. */
export const FEATURE_MARKERS = [
  { feature: 'studio-run', marker: 'You help edit a dashboard.' },
  {
    feature: 'studio-creation',
    marker: 'Propose semantic dashboard blocks for the analysis requested by the user prompt.',
  },
  { feature: 'text-to-sql', marker: 'You are a SQL query generator for a BI tool.' },
  { feature: 'chart-recommendation', marker: 'You are a data visualization expert for a BI tool.' },
  { feature: 'dashboard-insight', marker: 'You are a BI analyst.' },
];

const NUMERIC_TYPE = /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL|INT|REAL|NUMERIC)/i;
const TEMPORAL_TYPE = /^(DATE|TIMESTAMP)/i;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const MONEY_NAME = /amount|revenue|sales|price|cost|profit|payment|refund/i;
const MEASURE_NAME = /amount|revenue|sales|price|total|value|cost|profit|payment|qty|quantity|volume/i;
const CATEGORY_NAME = /channel|category|region|segment|status|type|product|country|name|grade|group/i;
const EDIT_WORDS = /제목|바꿔|변경|수정|이름/;
const UNSUPPORTED_WORDS = /삭제|지워|추가|만들|생성|저장|게시|공유|publish|share|delete|create|save/i;
const TITLE_PATTERNS = [
  /제목\s*(?:을|를|은|는)?\s*["“']?([^"”'\n]{1,100}?)["”']?\s*(?:으로|로)\s*(?:바꿔|변경|수정)/,
  /["“']([^"”'\n]{1,100})["”']\s*(?:으로|로)\s*(?:바꿔|변경|수정)/,
];

export const estimateTokens = text => Math.ceil(String(text ?? '').length / 4);

export function recognizeFeature(system) {
  const text = String(system ?? '');
  return FEATURE_MARKERS.find(entry => text.includes(entry.marker))?.feature ?? 'unknown';
}

const parseObject = text => {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

const unique = values => [...new Set(values)];
const isNumericColumn = column =>
  typeof column?.numeric === 'boolean' ? column.numeric : NUMERIC_TYPE.test(String(column?.type ?? ''));
const isTemporalColumn = column =>
  column?.temporal === true || TEMPORAL_TYPE.test(String(column?.type ?? ''));

/** The first title change found in the prompt, or null. Only used when the prompt asks for a title change. */
export function extractTitle(prompt) {
  for (const pattern of TITLE_PATTERNS) {
    const match = pattern.exec(prompt);
    const title = match?.[1]?.trim();
    if (title) return title;
  }
  return null;
}

/**
 * studio-run (StudioRunService.propose): intent + answer + at most one updateBlock on the selected block.
 * Edit = title change requested with a selected block. Ask = answer from the verified preview values.
 */
export function studioRunAnswer(userText) {
  const input = parseObject(userText) ?? {};
  const prompt = String(input.prompt ?? '');
  const selectedId = typeof input.selectedBlockId === 'string' ? input.selectedBlockId : null;
  const preview = Array.isArray(input.preview) ? input.preview : [];

  if (EDIT_WORDS.test(prompt)) {
    if (!selectedId)
      return { intent: 'clarify', answer: '수정할 블록을 먼저 선택해 주세요.', operations: [] };
    const title = extractTitle(prompt);
    if (!title)
      return {
        intent: 'clarify',
        answer: '새 제목을 따옴표로 감싸 알려 주세요. 예: "새 제목"으로 바꿔 주세요.',
        operations: [],
      };
    return {
      intent: 'edit',
      answer: `선택한 블록의 제목을 "${title}"(으)로 바꾸는 변경안입니다. 검증된 변경은 저장하지 않은 로컬 초안에 적용되며 실행 취소할 수 있습니다.`,
      operations: [{ type: 'updateBlock', blockId: selectedId, patch: { title } }],
    };
  }

  if (UNSUPPORTED_WORDS.test(prompt))
    return {
      intent: 'unsupported',
      answer:
        '이 요청은 지원하지 않습니다. 블록 제목·설명·표시 형식 수정과 미리보기 값 질문만 처리할 수 있습니다. 저장·게시·공유와 블록 추가·삭제는 Studio 화면에서 직접 진행해 주세요.',
      operations: [],
    };

  if (!selectedId)
    return {
      intent: 'clarify',
      answer: '질문하신 값을 확인하려면 블록을 먼저 선택해 주세요.',
      operations: [],
    };
  const widget = preview.find(item => item?.blockId === selectedId);
  if (!widget)
    return {
      intent: 'ask',
      answer: '선택한 블록의 미리보기 값이 없어 답할 수 없습니다. 기존 내용은 그대로 유지됩니다.',
      operations: [],
    };
  const rows = Array.isArray(widget.datas) ? widget.datas : [];
  const values = rows.map(row => Number(row?.[widget.valueField])).filter(Number.isFinite);
  if (!values.length)
    return {
      intent: 'ask',
      answer: `"${widget.title}" 미리보기에 숫자 값이 없어 답할 수 없습니다.`,
      operations: [],
    };
  const total = values.reduce((sum, value) => sum + value, 0);
  const decimals = Number.isSafeInteger(widget.decimalPlaces) ? widget.decimalPlaces : 0;
  const formatted = `${widget.prefix ?? ''}${total.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  })}${widget.suffix ?? ''}`;
  return {
    intent: 'ask',
    answer:
      `"${widget.title}"의 미리보기 값은 ${formatted}입니다.` +
      (widget.categoryField ? ` 분류 ${values.length}개를 합한 값입니다.` : '') +
      (widget.truncated ? ' 미리보기 행이 일부만 포함되어 전체 값과 다를 수 있습니다.' : ''),
    operations: [],
  };
}

const metricFor = (column, name, unit, decimalPlaces) => ({
  label: name,
  aggregation: 'SUM',
  column,
  unit,
  decimalPlaces,
  numberNotation: 'plain',
});

/**
 * studio-creation (StudioCreationService.proposeOnce): {requiredFields, title, semanticProposal} or a
 * `missingColumns` clarification. It never substitutes metrics for columns that are absent.
 */
export function studioCreationAnswer(userText) {
  const input = parseObject(userText) ?? {};
  const prompt = String(input.prompt ?? '');
  const source = input.source ?? {};
  const columns = Array.isArray(source.columns) ? source.columns : [];
  const byName = new Map(columns.map(column => [String(column.name).toLowerCase(), column]));
  const currency = ['KRW', 'USD'].includes(source.analysisContext?.currency)
    ? source.analysisContext.currency
    : null;
  const requested = unique([...prompt.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map(m => m[1]));
  const cannotBuild = (reason, requiredFields = requested) => ({
    requiredFields,
    clarifications: [
      {
        id: 'missingColumns',
        question: `[mock-provider] 제안을 만들 수 없습니다: ${reason}`,
        choices: [],
        affectedBlockIds: [],
      },
    ],
  });

  const missing = requested.filter(field => !byName.has(field.toLowerCase()));
  if (missing.length) return cannotBuild(`요청한 열이 소스에 없습니다 (${missing.join(', ')}).`);

  const numericColumn = name => {
    const column = byName.get(name.toLowerCase());
    return column && isNumericColumn(column) && !column.nonAdditive ? column.name : undefined;
  };
  const measures = columns.filter(column => isNumericColumn(column) && !column.nonAdditive);
  const primary =
    measures.find(c => MEASURE_NAME.test(c.name) && !/refund/i.test(c.name)) ??
    measures.find(c => !/refund/i.test(c.name)) ??
    measures[0];
  const temporal = columns.find(isTemporalColumn);
  const categories = columns.filter(c => !isNumericColumn(c) && !isTemporalColumn(c));
  const category = categories.find(c => CATEGORY_NAME.test(c.name)) ?? categories[0];

  const selectedIds = Array.isArray(input.selectedMetricIds) ? input.selectedMetricIds : [];
  const catalog = Array.isArray(input.metrics) ? input.metrics : [];
  const reuseBlocks = [];
  for (const id of selectedIds) {
    const entry = catalog.find(metric => metric.id === id);
    if (!entry) return cannotBuild('선택한 저장 지표를 카탈로그에서 찾을 수 없습니다.');
    reuseBlocks.push({
      title: String(entry.definition?.label ?? `지표 ${id}`).slice(0, 300),
      kind: 'BOARD_NUMERIC',
      metric: { id: entry.id, definitionVersion: entry.definitionVersion },
      presentation: 'visual',
    });
  }
  if (!primary && !selectedIds.length) return cannotBuild('합계할 숫자 열이 소스에 없습니다.');

  const refundBlocks = [];
  if (/환불\s*(?:률|율|비율)|refund\s*(?:rate|ratio|percentage)/i.test(prompt)) {
    const denominator = input.refundDenominator;
    const pair =
      denominator === 'orders'
        ? [numericColumn('refunded_orders') ?? numericColumn('refund_orders'), numericColumn('paid_orders')]
        : denominator === 'amount'
        ? [numericColumn('refund_amount'), numericColumn('revenue') ?? numericColumn('amount') ?? numericColumn('payment_amount')]
        : [];
    if (!pair[0] || !pair[1]) return cannotBuild('환불률의 분모와 필요한 열을 확인할 수 없습니다.');
    refundBlocks.push({
      title: '환불률',
      kind: 'BOARD_NUMERIC',
      metric: {
        label: '환불률',
        aggregation: 'RATIO_SUM',
        column: pair[0],
        denominatorColumn: pair[1],
        scale: 100,
        unit: '%',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      presentation: 'visual',
    });
  }

  const defaults = [];
  if (primary) {
    const money = MONEY_NAME.test(primary.name) && currency;
    const unit = money ? currency : '';
    const decimals = money && currency === 'USD' ? 2 : 0;
    const label = `${primary.name} 합계`;
    defaults.push({
      title: label,
      kind: 'BOARD_NUMERIC',
      metric: metricFor(primary.name, label, unit, decimals),
      presentation: 'visual',
    });
  }
  defaults.push({
    title: '건수',
    kind: 'BOARD_NUMERIC',
    metric: { label: '건수', aggregation: 'COUNT', column: '*', unit: '건', decimalPlaces: 0, numberNotation: 'plain' },
    presentation: 'visual',
  });
  if (primary && temporal) {
    defaults.push({
      title: `${temporal.name} 기준 ${primary.name} 추이`,
      kind: 'CHART_LINE',
      metric: metricFor(primary.name, `${primary.name} 합계`, '', 0),
      dimension: { column: temporal.name },
      presentation: 'visual',
    });
  } else if (primary && category) {
    defaults.push({
      title: `${category.name}별 ${primary.name}`,
      kind: 'CHART_BAR',
      metric: metricFor(primary.name, `${primary.name} 합계`, '', 0),
      dimension: { column: category.name },
      presentation: 'visual',
    });
  }

  const blocks = [...reuseBlocks, ...refundBlocks, ...defaults].slice(0, 6);
  const usedColumns = blocks.flatMap(block => [
    block.metric?.column,
    block.metric?.denominatorColumn,
    block.dimension?.column,
  ]);
  const requiredFields = unique(
    [...requested, ...usedColumns].filter(value => typeof value === 'string' && value !== '*'),
  );
  return {
    requiredFields,
    title: `${primary ? primary.name : '선택 지표'} 요약`,
    semanticProposal: blocks,
  };
}

/** text-to-sql: one read-only SELECT with a LIMIT, built from the schema text in the user message. */
export function textToSqlAnswer(userText) {
  const text = String(userText ?? '');
  const tables = [...text.matchAll(/^- ([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/gm)].map(match => ({
    name: match[1],
    columns: match[2]
      .split(',')
      .map(part => part.trim().split(/\s+/))
      .filter(([name, ...type]) => IDENT.test(name ?? '') && type.length)
      .map(([name, ...type]) => ({ name, type: type.join(' ') })),
  }));
  const table = tables.find(item => item.name === 'uploaded_data') ?? tables[0];
  const name = table?.name && IDENT.test(table.name) ? table.name : 'uploaded_data';
  const request = text.split('Request:').pop() ?? '';
  const numeric = table?.columns.find(column => NUMERIC_TYPE.test(column.type));
  if (!numeric || /개수|건수|몇|count|how many/i.test(request))
    return `SELECT COUNT(*) AS row_count FROM ${name} LIMIT 1000`;
  return `SELECT SUM(${numeric.name}) AS total FROM ${name} LIMIT 1000`;
}

/** chart recommendation: a type code from the registered list in the prompt, with a Korean reason. */
export function chartAnswer(userText) {
  const text = String(userText ?? '');
  const section = text.split('Available chart types:')[1] ?? '';
  const types = [...section.matchAll(/^- ([A-Za-z0-9_]+):/gm)].map(match => match[1]);
  if (!types.length) return JSON.stringify({ error: 'mock-provider: no chart types in prompt' });
  const fields = text.match(/^Fields: (.*)$/m)?.[1] ?? '';
  const hasDate = /\((DATE|TIMESTAMP)/i.test(fields);
  const hasNumeric = /\((U?BIGINT|U?INTEGER|DOUBLE|FLOAT|DECIMAL|INT|HUGEINT|REAL|NUMERIC)/i.test(fields);
  const wanted = hasDate ? /LINE/i : hasNumeric ? /BAR|COLUMN/i : null;
  const type = (wanted && types.find(item => wanted.test(item))) || types[0];
  const reason = hasDate
    ? '시간 필드가 있어 추이를 보기 좋은 선 차트를 추천합니다.'
    : hasNumeric
    ? '범주별 숫자 비교에 적합한 막대 차트를 추천합니다.'
    : '등록된 차트 중 첫 번째 유형을 추천합니다.';
  return JSON.stringify({ type, reason });
}

/** dashboard insight: 3 to 6 bullets (each starting with "- ") and one closing 총평 sentence. */
export function insightAnswer(userText) {
  const text = String(userText ?? '');
  const dashboard = /Dashboard: "([^"]*)"/.exec(text)?.[1] || '대시보드';
  const widgets = [...text.matchAll(/^Widget "([^"]*)" \(([^)]*)\)$/gm)].map(match => ({
    title: match[1],
    type: match[2],
  }));
  const bullets = widgets
    .slice(0, 4)
    .map(widget => `- "${widget.title}" (${widget.type}) 위젯은 샘플 데이터 기준으로 요약했습니다.`);
  const pads = [
    '- 샘플에 없는 기간이나 원인은 추측하지 않았습니다.',
    '- 제공된 샘플 범위 밖의 추세는 판단하지 않았습니다.',
    '- 이 문구는 계약 검증용 목업 응답이며 모델 품질 평가가 아닙니다.',
  ];
  bullets.push(...pads.slice(0, Math.max(0, 3 - bullets.length)));
  return `${bullets.join('\n')}\n총평: "${dashboard}"는 위젯 샘플 기준으로만 확인되었으며 세부 해석은 실제 데이터로 검증해야 합니다.`;
}

/** The normal answer for one request: the feature it was recognised as, and the assistant content. */
export function answerFor(system, user) {
  const feature = recognizeFeature(system);
  switch (feature) {
    case 'studio-run':
      return { feature, content: JSON.stringify(studioRunAnswer(user)) };
    case 'studio-creation':
      return { feature, content: JSON.stringify(studioCreationAnswer(user)) };
    case 'text-to-sql':
      return { feature, content: textToSqlAnswer(user) };
    case 'chart-recommendation':
      return { feature, content: chartAnswer(user) };
    case 'dashboard-insight':
      return { feature, content: insightAnswer(user) };
    default:
      return { feature: 'unknown', content: JSON.stringify({ error: 'mock-provider: unrecognised feature' }) };
  }
}

/** Usage with chars/4 estimates. `completionOverride` (control `usageTokens`) replaces completion_tokens. */
export function usageFor({ system, user, content, completionOverride = null }) {
  const promptTokens = estimateTokens(system) + estimateTokens(user);
  const completionTokens =
    Number.isSafeInteger(completionOverride) && completionOverride >= 0
      ? completionOverride
      : estimateTokens(content);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

class MockHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const errorBody = (message, type = 'mock_error', code = null) => ({
  error: { message, type, code },
});

function sendJson(res, status, payload) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new MockHttpError(413, 'request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Resolves after `ms`, or as soon as the client has gone, whichever comes first. */
function waitOrClose(res, ms) {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      res.off('close', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    res.once('close', done);
  });
}

const textOf = messages =>
  messages
    .map(message =>
      typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
        ? message.content.map(part => part?.text ?? '').join('\n')
        : '',
    )
    .join('\n');

const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function snapshot(state) {
  return {
    mode: state.mode,
    delayMs: state.delayMs,
    stallMs: state.stallMs,
    status: state.status,
    usageTokens: state.usageTokens,
    slowRemaining: state.slowRemaining,
    calls: state.calls.length,
  };
}

async function handleControl(req, res, state) {
  const body = parseObject(await readBody(req, 64 * 1024));
  if (!body) return sendJson(res, 400, errorBody('control body must be a JSON object', 'invalid_request_error'));
  // Validate everything first so that a bad field changes nothing.
  if (body.mode !== undefined && !MODES.includes(body.mode))
    return sendJson(res, 400, errorBody(`mode must be one of ${MODES.join(', ')}`, 'invalid_request_error'));
  if (body.delayMs !== undefined && !isInt(body.delayMs, 0, 600000))
    return sendJson(res, 400, errorBody('delayMs must be an integer 0..600000', 'invalid_request_error'));
  if (body.stallMs !== undefined && !isInt(body.stallMs, 0, 600000))
    return sendJson(res, 400, errorBody('stallMs must be an integer 0..600000', 'invalid_request_error'));
  if (body.status !== undefined && !isInt(body.status, 400, 599))
    return sendJson(res, 400, errorBody('status must be an HTTP error status 400..599', 'invalid_request_error'));
  if (body.usageTokens !== undefined && body.usageTokens !== null && !isInt(body.usageTokens, 0, 1e9))
    return sendJson(res, 400, errorBody('usageTokens must be null or a non-negative integer', 'invalid_request_error'));
  if (body.slowCalls !== undefined && !isInt(body.slowCalls, 0, 1000))
    return sendJson(res, 400, errorBody('slowCalls must be an integer 0..1000', 'invalid_request_error'));

  if (body.mode !== undefined) {
    state.mode = body.mode;
    if (body.mode === 'slow-then-ok') state.slowRemaining = body.slowCalls ?? 1;
  }
  if (body.delayMs !== undefined) state.delayMs = body.delayMs;
  if (body.stallMs !== undefined) state.stallMs = body.stallMs;
  if (body.status !== undefined) state.status = body.status;
  if (body.usageTokens !== undefined) state.usageTokens = body.usageTokens;
  if (body.clearCalls === true) state.calls.length = 0;
  return sendJson(res, 200, snapshot(state));
}

async function handleCompletion(req, res, state) {
  const startedAt = Date.now();
  const record = {
    id: `call-${state.nextId++}`,
    timestamp: new Date(startedAt).toISOString(),
    feature: 'unknown',
    model: null,
    mode: state.mode,
    jsonMode: false,
    messageSizes: { system: 0, user: 0, messages: 0 },
    status: null,
    finishReason: null,
    delayedMs: 0,
    aborted: false,
    durationMs: null,
  };
  state.calls.push(record);
  if (state.calls.length > 1000) state.calls.splice(0, state.calls.length - 1000);
  // A client that goes away before the response ended. (IncomingMessage 'close' fires once the request
  // body is read, so the response is the object to watch.)
  res.on('close', () => {
    if (!res.writableFinished) record.aborted = true;
  });

  const reply = (status, payload) => {
    record.status = status;
    record.durationMs = Date.now() - startedAt;
    sendJson(res, status, payload);
  };

  let parsed;
  try {
    parsed = parseObject(await readBody(req, 5 * 1024 * 1024));
  } catch (error) {
    return reply(error.status ?? 400, errorBody(error.message, 'invalid_request_error'));
  }
  if (!parsed || !Array.isArray(parsed.messages))
    return reply(400, errorBody('messages array required', 'invalid_request_error'));
  if (parsed.stream === true)
    return reply(400, errorBody('mock provider does not stream', 'invalid_request_error'));

  const system = textOf(parsed.messages.filter(message => message?.role === 'system'));
  const user = textOf(parsed.messages.filter(message => message?.role === 'user'));
  const answer = answerFor(system, user);
  record.feature = answer.feature;
  record.model = typeof parsed.model === 'string' ? parsed.model : null;
  record.jsonMode = parsed.response_format?.type === 'json_object';
  record.messageSizes = { system: system.length, user: user.length, messages: parsed.messages.length };

  const mode = state.mode;
  let content = answer.content;
  let finishReason = 'stop';
  let status = 200;
  let withUsage = true;
  let delay = 0;
  if (mode === 'http-error') {
    return reply(state.status, errorBody('mock provider unavailable (http-error mode)', 'server_error', String(state.status)));
  }
  if (mode === 'bad-json') content = 'mock-provider: this is not JSON {';
  if (mode === 'truncated') {
    content = content.slice(0, Math.max(1, Math.floor(content.length / 2)));
    finishReason = 'length';
  }
  if (mode === 'no-usage') withUsage = false;
  if (mode === 'delay') delay = state.delayMs;
  if (mode === 'stall-silent') {
    delay = state.stallMs;
    status = 504;
  }
  if (mode === 'slow-then-ok' && state.slowRemaining > 0) {
    state.slowRemaining -= 1;
    delay = state.delayMs;
  }

  if (delay > 0) {
    record.delayedMs = delay;
    await waitOrClose(res, delay);
    if (res.destroyed || res.writableFinished) return;
  }
  if (status !== 200)
    return reply(status, errorBody('mock provider timed out (stall-silent mode)', 'timeout_error', String(status)));

  const payload = {
    id: `chatcmpl-mock-${record.id}`,
    object: 'chat.completion',
    created: Math.floor(startedAt / 1000),
    model: record.model ?? 'mock-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }],
  };
  if (withUsage)
    payload.usage = usageFor({
      system,
      user,
      content,
      completionOverride: state.usageTokens,
    });
  record.finishReason = finishReason;
  reply(200, payload);
}

/** The request router. Returns the server; nothing listens until `listen` is called on it. */
export function createMockProvider({
  mode = 'normal',
  delayMs = 3000,
  stallMs = 120000,
  status = 503,
  usageTokens = null,
  slowCalls = 1,
} = {}) {
  const state = {
    mode,
    delayMs,
    stallMs,
    status,
    usageTokens,
    slowRemaining: slowCalls,
    nextId: 1,
    calls: [],
  };
  const server = http.createServer((req, res) => {
    route(req, res, state).catch(error => {
      console.error('mock-openai-provider:', error);
      sendJson(res, 500, errorBody('mock provider internal error', 'mock_error'));
    });
  });
  return { server, state };
}

async function route(req, res, state) {
  const { pathname } = new URL(req.url ?? '/', 'http://mock.local');
  if (req.method === 'GET' && pathname === '/health')
    return sendJson(res, 200, { status: 'ok', mode: state.mode, modes: MODES });
  if (req.method === 'GET' && pathname === '/__calls')
    return sendJson(res, 200, { count: state.calls.length, calls: state.calls });
  if (req.method === 'POST' && pathname === '/__control') return handleControl(req, res, state);
  if (req.method === 'POST' && pathname === '/v1/chat/completions')
    return handleCompletion(req, res, state);
  return sendJson(res, 404, errorBody('unknown mock endpoint', 'not_found'));
}

export function startServer({
  port = Number(process.env.MOCK_PORT || 4310),
  host = process.env.MOCK_HOST || '127.0.0.1',
  mode = 'normal',
} = {}) {
  const provider = createMockProvider({ mode });
  return new Promise((resolve, reject) => {
    provider.server.once('error', reject);
    provider.server.listen(port, host, () => resolve({ ...provider, host, port }));
  });
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  startServer()
    .then(({ server, host, port }) => {
      console.log(`mock-openai-provider listening on http://${host}:${port}/v1 (mode normal)`);
      for (const signal of ['SIGTERM', 'SIGINT'])
        process.on(signal, () => server.close(() => process.exit(0)));
    })
    .catch(error => {
      console.error(`mock-openai-provider failed to start: ${error.message}`);
      process.exit(1);
    });
}
