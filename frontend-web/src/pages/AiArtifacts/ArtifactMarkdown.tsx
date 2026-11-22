import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>,
  h2: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="font-semibold">{children}</h5>,
  h5: ({ children }) => <h6 className="font-semibold">{children}</h6>,
  h6: ({ children }) => <h6 className="font-semibold">{children}</h6>,
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children, style }) => <th scope="col" style={style} className="border-b border-border bg-muted px-3 py-2 text-left">{children}</th>,
  td: ({ children, style }) => <td style={style} className="border-b border-border px-3 py-2">{children}</td>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
  pre: ({ children }) => <pre className="max-w-full overflow-x-auto rounded-md bg-muted p-3 text-sm">{children}</pre>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children, start }) => <ol start={start} className="list-decimal space-y-1 pl-6">{children}</ol>,
  a: ({ href, children }) => /^(https?:\/\/|mailto:)/i.test(href ?? '')
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>
    : <span>{children}</span>,
  // Reading a private report must not contact remote image hosts.
  img: ({ alt }) => <span>{alt}</span>,
};

export function ArtifactMarkdown({ markdown }: { markdown: string }) {
  return (
    <article className="flex min-w-0 max-w-full flex-col gap-3 break-words rounded-xl border border-border bg-card p-4 leading-relaxed sm:p-6">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{markdown}</Markdown>
    </article>
  );
}
