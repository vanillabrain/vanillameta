import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PublishedBlockView } from '../Dashboard/Studio/PublishedBlockView';
import { ANCHOR_LIMITS, TextAnchor, documentText, locate, selectionOffsets, textAnchorAt } from './reportAnchor';
import {
  CommentAnchor,
  CommentSuggestion,
  CommentThread,
  authorLabel,
  commentError,
  reportCommentApi,
} from './reportCommentApi';
import { ReportReaderData, readerBlocks } from './reportSharingApi';

type Write = ReturnType<typeof reportCommentApi.reply>;
type Range = { start: number; end: number };
type ImageBlock = { id: string; kind: 'IMAGE'; dataUrl: string; alt: string; width: 'full' | 'half' };
const BODY_LIMIT = 4000;
const time = (value: string) => new Date(value).toLocaleString();
const quoteLabel = (quote: string) => `“${quote.length > 80 ? quote.slice(0, 80) + '…' : quote}”`;
const statusOf = (thread: CommentThread) => thread.location.status;
const locatedRange = (thread: CommentThread): Range | null =>
  thread.anchor.kind === 'text' &&
  (statusOf(thread) === 'exact' || statusOf(thread) === 'moved') &&
  thread.location.start !== undefined &&
  thread.location.end !== undefined
    ? { start: thread.location.start, end: thread.location.end }
    : null;
const statusText: Record<string, string> = {
  open: '열린 제안',
  applied: '적용됨',
  dismissed: '닫힘',
};

function anchorLabel(anchor: CommentAnchor, images: Array<{ id: string; alt: string }>) {
  if (anchor.kind === 'whole') return '보고서 전체';
  if (anchor.kind === 'image') {
    const image = images.find(block => block.id === anchor.blockId);
    return `이미지 · ${image?.alt || '설명 없음'}`;
  }
  return quoteLabel(anchor.quote);
}
function LocationNote({ status }: { status: string }) {
  if (status === 'detached')
    return <span className="report-comment-flag">원문에서 찾을 수 없음 · 저장된 인용문만 표시</span>;
  if (status === 'ambiguous')
    return <span className="report-comment-flag">같은 문구가 여러 곳에 있어 위치를 특정할 수 없음</span>;
  return null;
}

/** Splits the document text into plain and highlighted runs; their concatenation is the text itself. */
function segments(text: string, highlights: Array<Range & { id: string }>) {
  const cuts = new Set([0, text.length]);
  for (const range of highlights) {
    cuts.add(range.start);
    cuts.add(range.end);
  }
  const points = Array.from(cuts).sort((a, b) => a - b);
  const runs: Array<{ start: number; text: string; ids: string[] }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [start, end] = [points[i], points[i + 1]];
    if (end <= start) continue;
    runs.push({
      start,
      text: text.slice(start, end),
      ids: highlights.filter(range => range.start <= start && range.end >= end).map(range => range.id),
    });
  }
  return runs;
}

/** Text input whose requestId survives a failed send, so retrying the same text is a safe replay. */
function Composer({
  label,
  submit,
  placeholder,
  disabled,
  autoFocus,
  onCancel,
  send,
}: {
  label: string;
  submit: string;
  placeholder?: string;
  disabled: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  send: (body: string, requestId: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const id = useRef(`comment-${crypto.randomUUID()}`).current;
  const valid = body.trim().length > 0 && body.length <= BODY_LIMIT;
  return (
    <form
      className="report-comment-composer"
      onSubmit={async event => {
        event.preventDefault();
        if (!valid || disabled) return;
        if (await send(body, requestId)) {
          setBody('');
          setRequestId(crypto.randomUUID());
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <Textarea
        id={id}
        value={body}
        autoFocus={autoFocus}
        maxLength={BODY_LIMIT}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => {
          setBody(event.target.value);
          setRequestId(crypto.randomUUID());
        }}
      />
      <div className="report-comment-actions">
        <Button type="submit" size="sm" disabled={!valid || disabled}>
          {submit}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            취소
          </Button>
        )}
      </div>
    </form>
  );
}

function SuggestionComposer({
  quote,
  disabled,
  onCancel,
  send,
}: {
  quote: string;
  disabled: boolean;
  onCancel: () => void;
  send: (replacement: string, rationale: string, requestId: string) => Promise<boolean>;
}) {
  const [replacement, setReplacement] = useState(quote);
  const [rationale, setRationale] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const id = useRef(`suggest-${crypto.randomUUID()}`).current;
  const valid = replacement !== quote && replacement.length <= 20000 && rationale.length <= 2000;
  const change = (apply: () => void) => {
    apply();
    setRequestId(crypto.randomUUID());
  };
  return (
    <form
      className="report-comment-composer"
      aria-label="수정 제안 작성"
      onSubmit={async event => {
        event.preventDefault();
        if (valid && !disabled && (await send(replacement, rationale, requestId))) onCancel();
      }}
    >
      <p className="report-comment-quote">
        <span className="text-muted-foreground">바꿀 부분</span> {quoteLabel(quote)}
      </p>
      <label htmlFor={`${id}-text`}>바꿀 문구</label>
      <Textarea
        id={`${id}-text`}
        value={replacement}
        autoFocus
        disabled={disabled}
        onChange={event => change(() => setReplacement(event.target.value))}
      />
      <label htmlFor={`${id}-why`}>이유 (선택)</label>
      <Textarea
        id={`${id}-why`}
        value={rationale}
        maxLength={2000}
        disabled={disabled}
        onChange={event => change(() => setRationale(event.target.value))}
      />
      {replacement === quote && (
        <p className="text-xs text-muted-foreground">원문과 다른 문구를 입력해 주세요. 지우려면 비워 두세요.</p>
      )}
      <div className="report-comment-actions">
        <Button type="submit" size="sm" disabled={!valid || disabled}>
          제안 보내기
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

export function SuggestionDiff({ suggestion }: { suggestion: CommentSuggestion }) {
  return (
    <div className="report-comment-diff">
      <del aria-label="기존 문구">{suggestion.anchor.quote}</del>
      <ins aria-label="제안 문구">{suggestion.replacement || '(삭제)'}</ins>
      {suggestion.rationale && <p className="text-muted-foreground">{suggestion.rationale}</p>}
    </div>
  );
}

function ThreadCard({
  thread,
  role,
  images,
  active,
  canSuggest,
  busy,
  onSelect,
  run,
  reportId,
  version,
  text,
}: {
  thread: CommentThread;
  role: 'owner' | 'recipient';
  images: Array<{ id: string; alt: string }>;
  active: boolean;
  canSuggest: boolean;
  busy: boolean;
  onSelect: () => void;
  run: (action: () => Write) => Promise<boolean>;
  reportId: string;
  version: number;
  text: string;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const range = locatedRange(thread);
  const open = thread.status === 'open';
  return (
    <li
      id={`comment-thread-${thread.id}`}
      className="report-comment-thread"
      data-active={active || undefined}
      aria-label={`댓글 스레드 ${anchorLabel(thread.anchor, images)}`}
    >
      <button type="button" className="report-comment-target" onClick={onSelect}>
        <span className="report-comment-anchor">{anchorLabel(thread.anchor, images)}</span>
        <span className="text-xs text-muted-foreground">
          r{thread.version}
          {open ? '' : ' · 해결됨'}
        </span>
      </button>
      <LocationNote status={statusOf(thread)} />
      <ol className="report-comment-list">
        {thread.comments.map(comment => (
          <li key={comment.id}>
            <p className="report-comment-meta">
              <strong>{authorLabel(comment.author)}</strong> · {time(comment.createdAt)}
            </p>
            <p className="report-comment-body">{comment.body}</p>
          </li>
        ))}
      </ol>
      {thread.suggestions.map(suggestion => (
        <section key={suggestion.id} className="report-comment-suggestion" aria-label="수정 제안">
          <p className="report-comment-meta">
            <strong>{authorLabel(suggestion.author)}</strong> · {statusText[suggestion.status]}
            {suggestion.appliedVersion ? ` · r${suggestion.appliedVersion}` : ''}
          </p>
          <SuggestionDiff suggestion={suggestion} />
          {suggestion.status === 'open' && <LocationNote status={suggestion.location.status} />}
        </section>
      ))}
      {suggesting && range ? (
        <SuggestionComposer
          quote={text.slice(range.start, range.end)}
          disabled={busy}
          onCancel={() => setSuggesting(false)}
          send={(replacement, rationale, requestId) =>
            run(() =>
              reportCommentApi.suggest(reportId, {
                requestId,
                version,
                threadId: thread.id,
                anchor: textAnchorAt(text, range.start, range.end),
                replacement,
                ...(rationale.trim() ? { rationale } : {}),
              }),
            )
          }
        />
      ) : (
        <div className="report-comment-actions">
          {open && canSuggest && range && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSuggesting(true)}>
              수정 제안
            </Button>
          )}
          {(role === 'owner' || thread.mine) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  reportCommentApi.setStatus(reportId, thread.id, {
                    requestId: crypto.randomUUID(),
                    status: open ? 'resolved' : 'open',
                    expectedStatusVersion: thread.statusVersion,
                  }),
                )
              }
            >
              {open ? '해결' : '다시 열기'}
            </Button>
          )}
        </div>
      )}
      <Composer
        label="답글"
        submit="답글 남기기"
        disabled={busy}
        send={(body, requestId) => run(() => reportCommentApi.reply(reportId, thread.id, { requestId, body }))}
      />
    </li>
  );
}

/**
 * Reader body, frozen blocks and comment panel. Mount it only while the protected report is shown
 * and key it by the load generation: concealing unmounts it, which drops selection, drafts and
 * in-flight requests.
 */
export function ReaderDocument({
  id,
  data,
  live,
  onAccessFailure,
}: {
  id: string;
  data: ReportReaderData;
  live: () => boolean;
  onAccessFailure: () => void;
}) {
  const text = useMemo(() => documentText(data.documentBlocks, data.body), [data]);
  const images = data.documentBlocks.filter(block => block.kind === 'IMAGE') as ImageBlock[];
  const article = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const [list, setList] = useState<Awaited<ReturnType<typeof reportCommentApi.list>> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Range | null>(null);
  const [draft, setDraft] = useState<CommentAnchor | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ live, onAccessFailure });
  callbacks.current = { live, onAccessFailure };
  const alive = useCallback(() => mounted.current && callbacks.current.live(), []);
  const denied = useCallback((cause: unknown) => {
    const status = (cause as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) callbacks.current.onAccessFailure();
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    reportCommentApi
      .list(id, controller.signal)
      .then(result => {
        if (!controller.signal.aborted && alive()) setList(result);
      })
      .catch(cause => {
        if (controller.signal.aborted || !alive()) return;
        setLoadError(commentError(cause));
        denied(cause);
      });
    return () => controller.abort();
  }, [id, attempt, alive, denied]);
  const stale = !!list && list.version !== data.version;
  const threads = list?.threads ?? [];
  const highlights = stale
    ? []
    : threads
        .filter(thread => thread.status === 'open')
        .map(thread => ({ id: thread.id, range: locatedRange(thread) }))
        .filter(item => item.range)
        .map(item => ({ id: item.id, ...item.range }));
  const run = async (action: () => Write) => {
    if (busy || !alive()) return false;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (!alive()) return false;
      setList(current =>
        current
          ? {
              ...current,
              threads: current.threads.some(thread => thread.id === result.thread.id)
                ? current.threads.map(thread => (thread.id === result.thread.id ? result.thread : thread))
                : [...current.threads, result.thread],
            }
          : current,
      );
      setActive(result.thread.id);
      return true;
    } catch (cause) {
      if (alive()) {
        setError(commentError(cause));
        denied(cause);
      }
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const readSelection = () => {
    const current = window.getSelection();
    if (!article.current || !current || current.rangeCount === 0 || current.isCollapsed) {
      setSelection(null);
      return;
    }
    setSelection(selectionOffsets(article.current, current.getRangeAt(0), text));
  };
  const latestRead = useRef(readSelection);
  latestRead.current = readSelection;
  useEffect(() => {
    // Touch selection (long press, dragging handles) fires no mouseup/keyup on the article.
    let timer: number | undefined;
    const changed = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latestRead.current(), 120);
    };
    document.addEventListener('selectionchange', changed);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('selectionchange', changed);
    };
  }, []);
  const focusThread = (threadId: string) => {
    setActive(threadId);
    document.getElementById(`comment-thread-${threadId}`)?.scrollIntoView?.({ block: 'nearest' });
  };
  const ready = !!list && !stale;
  const tooLong = !!selection && selection.end - selection.start > ANCHOR_LIMITS.quote;
  return (
    <div className="report-reader-layout">
      <div className="report-editor-grid">
        <div className="report-document">
          <article
            ref={article}
            aria-label="보고서 본문"
            className="report-reader-text whitespace-pre-wrap break-words rounded-xl border bg-card p-6 text-base leading-8"
            onMouseUp={readSelection}
            onKeyUp={readSelection}
          >
            {segments(text, highlights).map(part =>
              part.ids.length ? (
                <mark
                  key={part.start}
                  className="report-comment-mark"
                  data-active={part.ids.includes(active) || undefined}
                  onClick={() => focusThread(part.ids[0])}
                >
                  {part.text}
                </mark>
              ) : (
                <React.Fragment key={part.start}>{part.text}</React.Fragment>
              ),
            )}
          </article>
          {selection && ready && (
            <div className="report-selection-action" role="group" aria-label="선택한 본문">
              <span className="report-comment-quote">{quoteLabel(text.slice(selection.start, selection.end))}</span>
              {tooLong ? (
                <span className="text-xs text-muted-foreground">2,000자 이내로 선택해 주세요.</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    setDraft(textAnchorAt(text, selection.start, selection.end));
                    setSelection(null);
                  }}
                >
                  선택한 부분에 댓글
                </Button>
              )}
            </div>
          )}
          {images.map(block => (
            <figure
              key={block.id}
              className={
                block.width === 'half' ? 'report-document-image report-document-image-half' : 'report-document-image'
              }
            >
              <img src={block.dataUrl} alt={block.alt} />
              {block.alt && <figcaption>{block.alt}</figcaption>}
              {ready && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  aria-label={`이미지 ${block.alt || '설명 없음'}에 댓글`}
                  onClick={() => setDraft({ kind: 'image', blockId: block.id })}
                >
                  댓글
                </Button>
              )}
            </figure>
          ))}
        </div>
        <div className="report-results">
          {readerBlocks(data).map(block => (
            <section key={block.id} className="report-frozen-block rounded-xl border bg-card">
              <PublishedBlockView block={block} />
            </section>
          ))}
        </div>
      </div>
      <aside className="report-comments rounded-xl border bg-card" aria-label="댓글">
        <div className="report-comments-head">
          <h2>댓글 {list ? threads.length : ''}</h2>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setAttempt(value => value + 1)}>
            새로 고침
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.role === 'owner'
            ? '모든 댓글과 제안을 봅니다. 제안은 편집 화면에서 적용합니다.'
            : '내가 시작한 스레드만 보이며 소유자도 볼 수 있습니다.'}
        </p>
        {ready && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDraft({ kind: 'whole' })}>
            보고서 전체에 댓글
          </Button>
        )}
        {!list && !loadError && <p className="text-sm text-muted-foreground">댓글을 불러오는 중입니다.</p>}
        {loadError && <p role="alert">{loadError}</p>}
        {stale && <p role="alert">보고서가 새 버전으로 바뀌었습니다. 보고서 다시 읽기를 선택해 주세요.</p>}
        {error && <p role="alert">{error}</p>}
        {draft && ready && (
          <div className="report-comment-new">
            <p className="report-comment-quote">
              <span className="text-muted-foreground">대상</span> {anchorLabel(draft, images)}
            </p>
            <Composer
              key={JSON.stringify(draft)}
              label="새 댓글"
              submit="댓글 남기기"
              autoFocus
              disabled={busy}
              onCancel={() => setDraft(null)}
              send={async (body, requestId) => {
                const ok = await run(() =>
                  reportCommentApi.createThread(id, { requestId, version: data.version, anchor: draft, body }),
                );
                if (ok) setDraft(null);
                return ok;
              }}
            />
          </div>
        )}
        {list && !threads.length && <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>}
        <ol className="report-comment-threads">
          {threads.map(thread => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              role={list.role}
              images={images}
              active={active === thread.id}
              canSuggest={ready}
              busy={busy}
              onSelect={() => setActive(thread.id)}
              run={run}
              reportId={id}
              version={data.version}
              text={text}
            />
          ))}
        </ol>
      </aside>
    </div>
  );
}

/** Where an open suggestion sits in the current draft, and whether it can be applied there. */
export function draftPlacement(suggestion: CommentSuggestion, draft: string) {
  const location = locate(suggestion.anchor as TextAnchor, draft);
  const applicable =
    (location.status === 'exact' || location.status === 'moved') &&
    location.start !== undefined &&
    location.end !== undefined &&
    draft.slice(location.start, location.end) === suggestion.anchor.quote;
  return { location, applicable };
}
