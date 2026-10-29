import { BadRequestException } from '@nestjs/common';
import { studioPivotResult, isStudioPivot } from './studio-pivot.service';
import {
  validateStudioConditions,
  validateStudioDateRange,
  validateStudioFilters,
} from './studio-document';
import { PublicationSnapshot } from './studio-publication-contract';
import { STUDIO_BREAKPOINTS, StudioDateRange, StudioDocumentV1 } from './studio-contract';

/** Calendar ranges are inclusive days in their IANA zone; timestamp ranges are half-open UTC instants. */
const dateRangePeriodLabel = (range: StudioDateRange) =>
  range.precision === 'timestamp'
    ? `${range.start} ~ ${range.end} (UTC, 종료 미포함)`
    : `${range.start} ~ ${range.end} (${range.timeZone ?? 'UTC'})`;

const documentDateRange = (document: StudioDocumentV1): StudioDateRange | undefined => {
  const stored = document.dateRange;
  return stored ? validateStudioDateRange(stored) : undefined;
};

export function sanitizeStudioSnapshot(
  document: StudioDocumentV1,
  preview: any,
): PublicationSnapshot {
  const invalid = () => {
    throw new BadRequestException('안전한 집계 결과를 확인할 수 없어 게시하지 않았습니다.');
  };
  if (!Array.isArray(preview?.widgets) || preview.widgets.length !== document.blocks.length)
    invalid();
  const ids = new Map(document.blocks.map((block, i) => [block.id, 'block-' + (i + 1)]));
  const scalar = (value: any): string | number | boolean | null => {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      return value;
    return invalid();
  };
  const blocks = document.blocks.map((block, i) => {
    const widget = preview.widgets[i];
    if (isStudioPivot(block)) {
      if (widget.type !== 'SEGMENT_PIVOT' || widget.blockId !== block.id) invalid();
      return {
        id: ids.get(block.id),
        title: block.title,
        description: block.description,
        kind: block.kind,
        display: { ...block.display },
        pivot: studioPivotResult(widget.pivot, true),
      };
    }
    const names = [
      widget.valueField,
      ...(block.kind === 'BOARD_NUMERIC' ? [] : [widget.categoryField]),
    ];
    if (
      widget.type !== block.kind ||
      widget.grainUnavailable ||
      names.some(
        n => typeof n !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(n),
      ) ||
      new Set(names).size !== names.length ||
      !Array.isArray(widget.datas) ||
      !Array.isArray(widget.fields)
    )
      invalid();
    if (block.kind === 'BOARD_NUMERIC' && widget.datas.length !== 1) invalid();
    const fields = names.map(name => {
      const f = widget.fields.find(f => f.columnName === name);
      if (!f || !['number', 'string', 'boolean', 'date', 'datetime'].includes(f.columnType))
        invalid();
      return { columnName: name, columnType: f.columnType };
    });
    const display = Object.fromEntries(
      ['timeGrain', 'decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'presentation']
        .filter(k => block.display[k] !== undefined)
        .map(k => [k, block.display[k]]),
    );
    const trend = widget.trend;
    if (
      trend &&
      (!Array.isArray(trend.points) ||
        !['auto', 'hour', 'day', 'week', 'month', 'minute'].includes(trend.grain))
    )
      invalid();
    return {
      id: ids.get(block.id),
      title: block.title,
      description: block.description,
      kind: block.kind,
      display,
      valueField: widget.valueField,
      ...(block.kind === 'BOARD_NUMERIC' ? {} : { categoryField: widget.categoryField }),
      fields,
      datas: widget.datas.map(row =>
        Object.fromEntries(names.map(name => [name, scalar(row[name])])),
      ),
      ...(trend
        ? {
            trend: {
              grain: trend.grain,
              ...(trend.timeZone ? { timeZone: String(trend.timeZone) } : {}),
              points: trend.points.map(p => {
                if (
                  typeof p.time !== 'string' ||
                  !(p.value === null || typeof p.value === 'string' || typeof p.value === 'number')
                )
                  invalid();
                return { time: p.time, value: scalar(p.value) as string | number | null };
              }),
            },
          }
        : {}),
    };
  });
  const dateRange = documentDateRange(document);
  if (document.conditions !== undefined) validateStudioConditions(document.conditions);
  return {
    ...(document.conditions !== undefined ? { conditionsApplied: true as const } : {}),
    title: document.title,
    periodLabel: dateRange ? dateRangePeriodLabel(dateRange) : '전체 기간',
    filters: document.filters?.length ? validateStudioFilters(document.filters) : [],
    ...(dateRange ? { dateRange } : {}),
    blocks,
    layouts: Object.fromEntries(
      STUDIO_BREAKPOINTS.map(bp => [
        bp,
        document.layouts[bp].map(g => ({ id: ids.get(g.id), x: g.x, y: g.y, w: g.w, h: g.h })),
      ]),
    ) as PublicationSnapshot['layouts'],
  };
}
