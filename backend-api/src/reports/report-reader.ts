import { InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';
import type { ReportResult } from './reports.service';
import { reportBlocks } from './report-contract';

const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const value = z.union([z.string(), z.number().finite(), z.null()]);
const type = z.enum(['string', 'number', 'boolean', 'date', 'datetime']);
const displaySchema = z.object({
  decimalPlaces: z.number().int().min(0).max(20).optional(),
  numberNotation: z.enum(['full', 'compact']).optional(),
  prefix: z.string().max(100).optional(),
  suffix: z.string().max(100).optional(),
  presentation: z.enum(['visual', 'table', 'summary']).optional(),
  timeGrain: z.enum(['auto', 'day', 'week', 'month']).optional(),
});
const trendSchema = z.object({
  grain: z.enum(['auto', 'hour', 'day', 'week', 'month', 'minute']),
  timeZone: z.string().max(100).optional(),
  points: z.array(z.object({ time: z.string().max(100), value })).max(10000),
});
const privateBlock = z.object({
  title: z.string().max(1000),
  description: z.string().max(10000),
  display: displaySchema,
  trend: trendSchema.optional(),
  kind: z.enum(['BOARD_NUMERIC', 'CHART_BAR', 'CHART_COLUMN', 'CHART_LINE']),
  valueField: z.string(),
  categoryField: z.string().optional(),
  fields: z.array(z.object({ columnName: z.string(), columnType: type })),
  datas: z.array(z.record(scalar)),
});
export function readerContent(report: ReportResult) {
  const corrupt = () => {
    throw new InternalServerErrorException('보고서 집계를 확인하지 못했습니다.');
  };
  const blocks = report.snapshot.rendered.blocks.map(raw => {
    const parsed = privateBlock.safeParse(raw);
    if (!parsed.success) return corrupt();
    const block = parsed.data;
    const valueType = block.fields.find(field => field.columnName === block.valueField)?.columnType;
    if (!valueType) return corrupt();
    const values = block.datas.map(row => {
      const parsedValue = value.safeParse(row[block.valueField]);
      return parsedValue.success ? parsedValue.data : corrupt();
    });
    const labels = { title: block.title, description: block.description, display: block.display };
    if (block.kind === 'BOARD_NUMERIC') {
      if (values.length !== 1) return corrupt();
      return {
        kind: 'kpi' as const,
        ...labels,
        valueType,
        value: values[0],
        ...(block.trend ? { trend: block.trend } : {}),
      };
    }
    const categoryType = block.fields.find(
      field => field.columnName === block.categoryField,
    )?.columnType;
    if (!block.categoryField || !categoryType) return corrupt();
    const categoryField = block.categoryField;
    return {
      kind: 'chart' as const,
      ...labels,
      chart: block.kind,
      valueType,
      categoryType,
      points: block.datas.map((row, i) => ({
        category: scalar.parse(row[categoryField]),
        value: values[i],
      })),
    };
  });
  if (blocks.length !== 2 || blocks.filter(block => block.kind === 'kpi').length !== 1) corrupt();
  const document = reportBlocks.safeParse(report.blocks ?? []);
  if (!document.success) corrupt();
  return {
    title: report.title,
    body: report.body,
    documentBlocks: document.success ? document.data : [],
    version: report.version,
    savedAt: report.savedAt,
    period: report.snapshot.rendered.periodLabel,
    timeZone: report.snapshot.basis.timeZone,
    capturedAt: report.snapshot.capturedAt,
    blocks,
  };
}
