import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthorName, CommentComposer, CommentFlag, CommentThreadItem } from '@/components/comments/CommentThread';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PublishedBlockView } from '../Dashboard/Studio/PublishedBlockView';
import { ANCHOR_LIMITS, TextAnchor, documentText, locate, selectionOffsets, textAnchorAt } from './reportAnchor';
import { CommentAnchor, CommentSuggestion, CommentThread, commentError, reportCommentApi } from './reportCommentApi';
import { ReportReaderData, readerBlocks } from './reportSharingApi';

type Write = ReturnType<typeof reportCommentApi.reply>;
type Range = { start: number; end: number };
type ImageBlock = { id: string; kind: 'IMAGE'; dataUrl: string; alt: string; width: 'full' | 'half' };
/** An empty quote is old text the server withholds from people who did not write the thread. */
const quoteLabel = (quote: string) =>
  quote ? `“${quote.length > 80 ? quote.slice(0, 80) + '…' : quote}”` : '이전 버전 본문';
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
  if (status === 'detached') return <CommentFlag>원문에서 찾을 수 없음 · 저장된 인용문만 표시</CommentFlag>;
  if (status === 'ambiguous') return <CommentFlag>같은 문구가 여러 곳에 있어 위치를 특정할 수 없음</CommentFlag>;
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
      <del aria-label="기존 문구">{suggestion.anchor.quote || '(이전 버전 본문)'}</del>
      <ins aria-label="제안 문구">{suggestion.replacement || '(삭제)'}</ins>
      {suggestion.rationale && <p className="text-muted-foreground">{suggestion.rationale}</p>}
    </div>
  );
}

function ThreadCard({
  thread,
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
  const shared = thread.visibility === 'participants';
  const changeVisibility = (visibility: CommentThread['visibility']) =>
    void run(() => reportCommentApi.setVisibility(reportId, thread.id, { requestId: crypto.randomUUID(), visibility }));
  return (
    <CommentThreadItem
      threadId={thread.id}
      label={anchorLabel(thread.anchor, images)}
      meta={`r${thread.version}${shared ? ' · 공개' : ''}${open ? '' : ' · 해결됨'}`}
      notes={
        <>
          <LocationNote status={statusOf(thread)} />
          {shared && thread.viewerCount !== null && (
            <CommentFlag tone="info">
              {thread.viewerCount
                ? `공유받은 사람 ${thread.viewerCount}명이 볼 수 있음`
                : '지금 볼 수 있는 공유받은 사람 없음 · 이 버전을 공유하면 보입니다'}
            </CommentFlag>
          )}
        </>
      }
      comments={thread.comments}
      resolved={!open}
      active={active}
      busy={busy}
      onSelect={onSelect}
      onToggleStatus={
        thread.canManage
          ? () =>
              void run(() =>
                reportCommentApi.setStatus(reportId, thread.id, {
                  requestId: crypto.randomUUID(),
                  status: open ? 'resolved' : 'open',
                  expectedStatusVersion: thread.statusVersion,
                }),
              )
          : undefined
      }
      onReply={(body, requestId) => run(() => reportCommentApi.reply(reportId, thread.id, { requestId, body }))}
      extraActions={
        <>
          {open && canSuggest && thread.canManage && range && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSuggesting(true)}>
              수정 제안
            </Button>
          )}
          {thread.canManage && !shared && thread.mine && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => changeVisibility('participants')}
            >
              공유받은 사람에게 공개{thread.viewerCount ? ` (${thread.viewerCount}명)` : ''}
            </Button>
          )}
          {thread.canManage && shared && !thread.narrowLocked && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => changeVisibility('private')}>
              비공개로 전환
            </Button>
          )}
        </>
      }
      editor={
        suggesting && range ? (
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
        ) : undefined
      }
    >
      {thread.suggestions.map(suggestion => (
        <section key={suggestion.id} className="report-comment-suggestion" aria-label="수정 제안">
          <p className="report-comment-meta">
            <AuthorName author={suggestion.author} /> · {statusText[suggestion.status]}
            {suggestion.appliedVersion ? ` · r${suggestion.appliedVersion}` : ''}
          </p>
          <SuggestionDiff suggestion={suggestion} />
          {suggestion.status === 'open' && <LocationNote status={suggestion.location.status} />}
        </section>
      ))}
    </CommentThreadItem>
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
  const [shareDraft, setShareDraft] = useState(false);
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
  // A notification link opens the reader with ?thread=; select it once the list has it.
  const requestedThread = useSearchParams()[0].get('thread');
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedThread || opened.current === requestedThread) return;
    if (!list?.threads.some(thread => thread.id === requestedThread)) return;
    opened.current = requestedThread;
    setActive(requestedThread);
    document.getElementById(`comment-thread-${requestedThread}`)?.scrollIntoView?.({ block: 'center' });
  }, [list, requestedThread]);
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
            : '내가 시작한 스레드와 공개된 스레드가 보입니다. 비공개 스레드는 소유자만 함께 봅니다.'}
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
            <label className="report-comment-share">
              <input
                type="checkbox"
                checked={shareDraft}
                disabled={busy}
                onChange={event => setShareDraft(event.target.checked)}
              />
              공유받은 사람에게도 공개
            </label>
            {shareDraft && (
              <p className="text-xs text-muted-foreground">
                소유자와 이 버전을 공유받은 사람 모두에게 아이디와 함께 보입니다.
              </p>
            )}
            <CommentComposer
              key={JSON.stringify(draft)}
              scope={shareDraft ? 'participants' : 'private'}
              label="새 댓글"
              submit="댓글 남기기"
              autoFocus
              disabled={busy}
              onCancel={() => setDraft(null)}
              send={async (body, requestId) => {
                const ok = await run(() =>
                  reportCommentApi.createThread(id, {
                    requestId,
                    version: data.version,
                    anchor: draft,
                    body,
                    ...(shareDraft ? { visibility: 'participants' as const } : {}),
                  }),
                );
                if (ok) {
                  setDraft(null);
                  setShareDraft(false);
                }
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
