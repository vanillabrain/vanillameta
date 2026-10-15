import { BadRequestException } from '@nestjs/common';

/** Explicit allowlist for the public snapshot: everything else is dropped, never copied. */
export const PUBLICATION_SCHEMA_VERSION = 1 as const;
export const PUBLICATION_SCOPE = '전체 기간 · 필터 없음 · UTC';
export const PUBLICATION_MAX_BYTES = 1024 * 1024;
export const PUBLICATION_MAX_WIDGETS = 6;
export const PUBLICATION_MAX_ROWS = 2000;
export const PUBLICATION_MAX_TREND_POINTS = 240;

const WIDGET_TYPES = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
const TREND_GRAINS = ['hour', 'day', 'week', 'month'];
const BREAKPOINTS = ['mobile', 'tablet', 'desktop'] as const;
const BREAKPOINT_COLUMNS = { mobile: 4, tablet: 8, desktop: 12 } as const;
const LAYOUT_MESSAGE = '게시할 블록 배치 정보가 없습니다. 저장 화면에서 배치를 확인해 주세요.';

export type PublicationRect = { x: number; y: number; w: number; h: number };
export type PublicationRowValue = number | string | boolean | null;
export type PublicationTrendPoint = { time: string; value: PublicationRowValue };
export type PublicationTrend = {
  column: string;
  grain: string;
  points: PublicationTrendPoint[];
  timeZone?: string;
};
export type PublicationWidget = {
  blockId: string;
  title: string;
  description: string;
  type: string;
  valueField: string;
  categoryField?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  numberNotation?: string;
  datas: Array<Record<string, PublicationRowValue>>;
  trend?: PublicationTrend;
  trendUnavailable?: string;
};
export type PublicationSnapshot = {
  schemaVersion: 1;
  title: string;
  capturedAt: string;
  scope: string;
  widgets: PublicationWidget[];
  responsiveLayouts: Record<string, Record<string, PublicationRect>>;
};

function reject(message: string): never {
  throw new BadRequestException(message);
}

function boundedText(value: unknown, max: number, message: string): string {
  if (typeof value !== 'string' || value.length > max) reject(message);
  return value;
}

function requiredText(value: unknown, max: number, message: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) reject(message);
  return value;
}

function cellValue(value: unknown, message: string): PublicationRowValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value.length > 2000 ? reject(message) : value;
  if (value instanceof Date) return value.toISOString();
  return reject(message);
}

/** Display rows keep only the selected value column and the optional category column. */
function projectRows(
  datas: unknown,
  valueField: string,
  categoryField: string | undefined,
): Array<Record<string, PublicationRowValue>> {
  const message = '게시 결과의 표시 값을 확인할 수 없습니다.';
  if (!Array.isArray(datas) || datas.length > PUBLICATION_MAX_ROWS)
    reject('게시 결과의 블록별 행이 너무 많습니다. 기간을 줄여 주세요.');
  return datas.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) reject(message);
    if (!Object.prototype.hasOwnProperty.call(row, valueField)) reject(message);
    const projected: Record<string, PublicationRowValue> = {
      [valueField]: cellValue((row as any)[valueField], message),
    };
    if (categoryField && !Object.prototype.hasOwnProperty.call(row, categoryField)) reject(message);
    if (
      categoryField &&
      Object.prototype.hasOwnProperty.call(row, categoryField) &&
      !Object.prototype.hasOwnProperty.call(projected, categoryField)
    )
      Object.defineProperty(projected, categoryField, {
        value: cellValue((row as any)[categoryField], message),
        enumerable: true,
      });
    return projected;
  });
}

function projectTrend(trend: unknown, blockId: string): PublicationTrend {
  const message = '게시할 시계열 정보를 확인해 주세요.';
  if (!trend || typeof trend !== 'object' || Array.isArray(trend)) reject(message);
  const source = trend as any;
  const points = source.points;
  if (!Array.isArray(points) || points.length > PUBLICATION_MAX_TREND_POINTS)
    reject('시계열 시점이 너무 많습니다. 기간을 줄이거나 더 큰 단위를 선택해 주세요.');
  const projected: PublicationTrend = {
    column: requiredText(source.column, 255, message),
    grain: TREND_GRAINS.includes(source.grain) ? source.grain : reject(message),
    points: points.map((point: any) => {
      if (!point || typeof point !== 'object' || Array.isArray(point)) reject(message);
      return {
        time: requiredText(point.time, 64, message),
        value: cellValue(point.value, message),
      };
    }),
  };
  if (source.timeZone !== undefined)
    projected.timeZone = requiredText(source.timeZone, 64, message);
  if (blockId.length === 0) reject(message);
  return projected;
}

export function sanitizePublicationWidget(input: any): PublicationWidget {
  const message = '게시할 수 없는 블록 정의입니다.';
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject(message);
  if (input.contribution?.supported !== true) reject(message);
  const reserved = new Set(['__proto__', 'constructor', 'prototype']);
  const blockId = requiredText(input.blockId, 128, message);
  if (reserved.has(blockId)) reject(message);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(blockId)) reject(message);
  const type = WIDGET_TYPES.includes(input.type) ? input.type : reject(message);
  const valueField = requiredText(input.valueField, 255, message);
  if (reserved.has(valueField) || reserved.has(input.categoryField)) reject(message);
  const widget: PublicationWidget = {
    blockId,
    title: requiredText(input.title, 300, message),
    description: boundedText(input.description ?? '', 1000, message),
    type,
    valueField,
    datas: projectRows(input.datas, valueField, undefined),
  };
  if (type !== 'BOARD_NUMERIC')
    widget.categoryField = requiredText(input.categoryField, 255, message);
  if (type === 'BOARD_NUMERIC' && widget.datas.length !== 1) reject(message);
  if (input.prefix !== undefined) widget.prefix = boundedText(input.prefix, 100, message);
  if (input.suffix !== undefined) widget.suffix = boundedText(input.suffix, 100, message);
  if (input.decimalPlaces !== undefined) {
    if (
      !Number.isInteger(input.decimalPlaces) ||
      input.decimalPlaces < 0 ||
      input.decimalPlaces > 6
    )
      reject(message);
    widget.decimalPlaces = input.decimalPlaces;
  }
  if (input.numberNotation !== undefined) {
    if (!['full', 'compact'].includes(input.numberNotation)) reject(message);
    widget.numberNotation = input.numberNotation;
  }
  if (widget.categoryField !== undefined)
    widget.datas = projectRows(input.datas, valueField, widget.categoryField);
  if (input.trendUnavailable !== undefined)
    widget.trendUnavailable = boundedText(input.trendUnavailable, 500, message);
  if (input.trend !== undefined) widget.trend = projectTrend(input.trend, blockId);
  return widget;
}

/** All three breakpoints must exist and match the block ids; incomplete or overlapping layouts fail closed. */
function projectResponsiveLayouts(
  value: unknown,
  blockIds: string[],
): Record<string, Record<string, PublicationRect>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(LAYOUT_MESSAGE);
  const source = value as Record<string, any>;
  const result: Record<string, Record<string, PublicationRect>> = {};
  for (const name of BREAKPOINTS) {
    const map = source[name];
    if (!map || typeof map !== 'object' || Array.isArray(map)) reject(LAYOUT_MESSAGE);
    const columns = BREAKPOINT_COLUMNS[name];
    const rects: Record<string, PublicationRect> = {};
    const placed: PublicationRect[] = [];
    for (const id of blockIds) {
      const rect = map[id];
      if (!rect || typeof rect !== 'object' || Array.isArray(rect)) reject(LAYOUT_MESSAGE);
      const { x, y, w, h } = rect as PublicationRect;
      if (
        ![x, y, w, h].every(item => Number.isSafeInteger(item)) ||
        x < 0 ||
        y < 0 ||
        w < 1 ||
        h < 1 ||
        x + w > columns ||
        y > 1000 ||
        h > 50
      )
        reject('게시할 블록 배치의 범위를 확인해 주세요.');
      if (
        placed.some(
          other =>
            x < other.x + other.w && other.x < x + w && y < other.y + other.h && other.y < y + h,
        )
      )
        reject('게시할 블록 배치가 겹칩니다. 위치를 조정해 주세요.');
      placed.push({ x, y, w, h });
      rects[id] = { x, y, w, h };
    }
    result[name] = rects;
  }
  return result;
}

export function buildPublicationSnapshot(input: {
  title: unknown;
  widgets: unknown;
  responsiveLayouts: unknown;
  capturedAt?: Date | string;
}): { snapshot: PublicationSnapshot; bytes: number } {
  const title = requiredText(input.title, 300, '게시할 분석 제목을 확인해 주세요.');
  if (
    !Array.isArray(input.widgets) ||
    input.widgets.length < 1 ||
    input.widgets.length > PUBLICATION_MAX_WIDGETS
  )
    reject('게시에는 1~6개의 블록이 필요합니다.');
  const widgets = input.widgets.map(sanitizePublicationWidget);
  const blockIds = widgets.map(widget => widget.blockId);
  if (new Set(blockIds).size !== blockIds.length) reject('게시할 수 없는 블록 정의입니다.');
  const captured =
    input.capturedAt instanceof Date ? input.capturedAt : new Date(input.capturedAt ?? Date.now());
  if (Number.isNaN(captured.getTime())) reject('게시 시점을 확인할 수 없습니다.');
  const snapshot: PublicationSnapshot = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    title,
    capturedAt: captured.toISOString(),
    scope: PUBLICATION_SCOPE,
    widgets,
    responsiveLayouts: projectResponsiveLayouts(input.responsiveLayouts, blockIds),
  };
  const bytes = Buffer.byteLength(JSON.stringify(snapshot));
  if (bytes > PUBLICATION_MAX_BYTES)
    reject('게시 결과가 너무 큽니다. 블록이나 기간을 줄여 주세요.');
  return { snapshot, bytes };
}
