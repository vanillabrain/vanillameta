import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { z } from 'zod';
import { aiArtifactService, AiArtifactDetail } from '@/api/aiArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';

const htmlSchema = z.object({ html: z.string() });
const documentSchema = z.object({ markdown: z.string() });
const sheetSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
});
const chartSchema = z.object({
  chartType: z.enum(['bar', 'line']),
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), data: z.array(z.number()) })),
});

function HtmlBody({ content }: { content: Record<string, unknown> }) {
  const { html } = htmlSchema.parse(content);
  return (
    <iframe
      title="artifact"
      sandbox=""
      referrerPolicy="no-referrer"
      {...({
        csp: "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      } as unknown as React.IframeHTMLAttributes<HTMLIFrameElement>)}
      srcDoc={html}
      className="min-h-[480px] w-full rounded-xl border border-border bg-white"
    />
  );
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const items = list.map((item, index) => <li key={index}>{inline(item)}</li>);
    blocks.push(ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = [];
  };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 6) as 2 | 3 | 4 | 5 | 6;
      blocks.push(React.createElement(`h${level}`, { key: blocks.length }, inline(heading[2])));
    } else if (bullet || numbered) {
      flushParagraph();
      const nextOrdered = Boolean(numbered);
      if (list.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      const item = (bullet ?? numbered) as RegExpExecArray;
      list.push(item[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function DocumentBody({ content }: { content: Record<string, unknown> }) {
  const { markdown } = documentSchema.parse(content);
  return (
    <article className="prose flex max-w-none flex-col gap-3 rounded-xl border border-border bg-card p-6">
      {renderMarkdown(markdown)}
    </article>
  );
}

function SheetBody({ content }: { content: Record<string, unknown> }) {
  const { columns, rows } = sheetSchema.parse(content);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column} className="border-b border-border px-4 py-2 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td key={column} className="border-b border-border px-4 py-2">
                  {row[columnIndex] === null ? '' : String(row[columnIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBody({ content }: { content: Record<string, unknown> }) {
  const { chartType, labels, series } = chartSchema.parse(content);
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map(item => item.name) },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: series.map(item => ({ name: item.name, type: chartType, data: item.data })),
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <ReactECharts option={option} style={{ height: 420 }} notMerge={true} />
    </div>
  );
}

function Body({ artifact }: { artifact: AiArtifactDetail }) {
  if (artifact.kind === 'html') return <HtmlBody content={artifact.content} />;
  if (artifact.kind === 'document') return <DocumentBody content={artifact.content} />;
  if (artifact.kind === 'sheet') return <SheetBody content={artifact.content} />;
  return <ChartBody content={artifact.content} />;
}

export default function AiArtifactView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const scope = personalLibrarySessionScope();
  const query = useQuery({
    queryKey: ['ai-artifact', scope, id],
    queryFn: async ({ signal }) => {
      const detail = await aiArtifactService.detail(id as string, signal);
      if (scope !== personalLibrarySessionScope()) throw new Error('Session changed');
      return detail;
    },
    enabled: !!scope && !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 p-4 sm:p-8 lg:p-12">
      <Button asChild variant="ghost" className="h-10 self-start">
        <Link to="/dashboard">{t('aiArtifact.back')}</Link>
      </Button>
      {query.isFetching && <p role="status">{t('aiArtifact.loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {t('aiArtifact.error')}
        </p>
      )}
      {!query.isFetching && !query.isError && query.data && (
        <>
          <h1 className="break-words text-2xl font-semibold">{query.data.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t('aiArtifact.revision')} {query.data.revision}
          </p>
          <Body artifact={query.data} />
        </>
      )}
    </main>
  );
}
