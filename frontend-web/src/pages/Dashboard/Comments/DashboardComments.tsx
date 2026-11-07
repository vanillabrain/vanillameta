import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { CommentComposer, CommentFlag, CommentThreadItem } from '@/components/comments/CommentThread';
import { commentError, commentFailure } from '@/components/comments/commentModel';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  DashboardAnchorRequest,
  DashboardBlock,
  DashboardCommentList,
  DashboardCommentWrite,
  DashboardThread,
  dashboardCommentApi,
} from './dashboardCommentApi';

/** Same width contract as the dashboard Assistant: below lg the panel is a modal sheet. */
const MODAL_QUERY = '(max-width: 1199.95px)';
const PANEL_ID = 'dashboard-comments-panel';
const WHOLE = '__whole__';
const REVISION_CONFLICT =
  '그 사이 대시보드가 바뀌어 댓글 목록을 새로 불러왔습니다. 입력은 그대로 두었습니다. 대상을 확인한 뒤 다시 보내 주세요.';

function useModalPanel() {
  const [modal, setModal] = useState(() => window.matchMedia?.(MODAL_QUERY).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(MODAL_QUERY);
    if (!list) return;
    const sync = (event: MediaQueryListEvent) => setModal(event.matches);
    list.addEventListener?.('change', sync);
    return () => list.removeEventListener?.('change', sync);
  }, []);
  return modal;
}

const blockCard = (blockId: string) => document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
const chartLabel = (title: string) => `차트 · ${title || '제목 없음'}`;
const threadLabel = (thread: DashboardThread) =>
  thread.anchor.kind === 'whole' ? '대시보드 전체' : chartLabel(thread.anchor.title);

export type DashboardCardComments = {
  blocks: ReadonlySet<string>;
  activeBlockId: string | null;
  onComment: (blockId: string, opener: HTMLElement) => void;
};

export function useDashboardComments(dashboardId: string, revisionKey: string, enabled = true) {
  const modal = useModalPanel();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<DashboardCommentList | null>(null);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DashboardAnchorRequest | null>(null);
  const [focusDraft, setFocusDraft] = useState(0);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const afterClose = useRef<HTMLElement | null>(null);
  const scope = useRef(dashboardId);
  scope.current = dashboardId;

  useEffect(() => {
    setOpen(false);
    setList(null);
    setLoadError('');
    setUnavailable(false);
    setError('');
    setDraft(null);
    setActiveThread(null);
    setActiveBlock(null);
  }, [dashboardId]);

  useEffect(() => {
    if (!enabled || unavailable) return;
    const controller = new AbortController();
    setLoadError('');
    dashboardCommentApi
      .list(dashboardId, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setList(result);
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        const { status } = commentFailure(cause);
        if (status === 401 || status === 403) {
          setUnavailable(true);
          setList(null);
          setDraft(null);
        } else setLoadError(commentError(cause, '대시보드'));
      });
    return () => controller.abort();
  }, [dashboardId, enabled, unavailable, attempt, revisionKey]);

  const run = async (action: () => Promise<DashboardCommentWrite>) => {
    if (busy) return false;
    const requested = dashboardId;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (scope.current !== requested) return false;
      setList(
        current =>
          current && {
            ...current,
            threads: current.threads.some(thread => thread.id === result.thread.id)
              ? current.threads.map(thread => (thread.id === result.thread.id ? result.thread : thread))
              : [...current.threads, result.thread],
          },
      );
      setActiveThread(result.thread.id);
      return true;
    } catch (cause) {
      if (scope.current !== requested) return false;
      const { status, code } = commentFailure(cause);
      setError(code === 'REVISION_CONFLICT' ? REVISION_CONFLICT : commentError(cause, '대시보드'));
      if (status === 403 || status === 404 || (status === 409 && code !== 'COMMENT_LIMIT')) setAttempt(value => value + 1);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const show = (next: DashboardAnchorRequest | null, from: HTMLElement | null) => {
    opener.current = from;
    setError('');
    setOpen(true);
    if (next) {
      setDraft(next);
      setFocusDraft(value => value + 1);
    }
  };
  const dismiss = () => {
    setOpen(false);
    setActiveBlock(null);
  };
  const close = () => {
    dismiss();
    const target = opener.current?.isConnected ? opener.current : trigger.current;
    if (!modal) target?.focus();
  };
  const selectThread = (thread: DashboardThread) => {
    setActiveThread(thread.id);
    if (thread.anchor.kind !== 'block' || thread.location !== 'exact') {
      setActiveBlock(null);
      return;
    }
    const card = blockCard(thread.anchor.blockId);
    setActiveBlock(thread.anchor.blockId);
    if (modal) {
      // The sheet covers the chart: close it and land focus on the chart's own comment button.
      afterClose.current = card?.querySelector<HTMLElement>('[data-comment-trigger]') ?? null;
      setOpen(false);
    } else card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };

  const cards: DashboardCardComments | undefined = list?.blockAnchors
    ? {
        blocks: new Set(list.blocks.map(block => block.blockId)),
        activeBlockId: activeBlock,
        onComment: (blockId, from) => show({ kind: 'block', blockId }, from),
      }
    : undefined;

  return {
    dashboardId,
    enabled,
    modal,
    open,
    list,
    loadError,
    unavailable,
    error,
    busy,
    draft,
    focusDraft,
    activeThread,
    trigger,
    afterClose,
    cards,
    setDraft,
    show,
    close,
    dismiss,
    reload: () => setAttempt(value => value + 1),
    selectThread,
    run,
  };
}
export type DashboardCommentsModel = ReturnType<typeof useDashboardComments>;

export function DashboardCommentsButton({ comments, disabled }: { comments: DashboardCommentsModel; disabled: boolean }) {
  if (!comments.enabled || (comments.unavailable && !comments.open)) return null;
  const count = comments.list?.threads.length;
  return (
    <Button
      ref={comments.trigger}
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 bg-background"
      aria-expanded={comments.open}
      aria-controls={PANEL_ID}
      disabled={disabled}
      title={disabled ? 'Assistant를 닫으면 댓글을 열 수 있습니다.' : undefined}
      onClick={event => (comments.open ? comments.close() : comments.show(null, event.currentTarget))}
    >
      <MessageSquare aria-hidden="true" />
      댓글{count ? ` ${count}` : ''}
    </Button>
  );
}

function NewThread({ comments, list }: { comments: DashboardCommentsModel; list: DashboardCommentList }) {
  const box = useRef<HTMLDivElement>(null);
  const draft = comments.draft;
  useEffect(() => {
    if (comments.focusDraft) box.current?.querySelector('textarea')?.focus();
  }, [comments.focusDraft]);
  if (!draft) return null;
  const block: DashboardBlock | undefined =
    draft.kind === 'block' ? list.blocks.find(item => item.blockId === draft.blockId) : undefined;
  const missing = draft.kind === 'block' && !block;
  return (
    <div ref={box} className="report-comment-new">
      {list.blockAnchors ? (
        <div className="grid gap-1.5">
          <label htmlFor="dashboard-comment-target" className="text-sm font-medium">
            대상
          </label>
          <NativeSelect
            id="dashboard-comment-target"
            className="w-full"
            value={draft.kind === 'whole' ? WHOLE : block ? block.blockId : ''}
            disabled={comments.busy}
            onChange={event =>
              comments.setDraft(
                event.target.value === WHOLE ? { kind: 'whole' } : { kind: 'block', blockId: event.target.value },
              )
            }
          >
            {missing && (
              <NativeSelectOption value="" disabled>
                차트를 다시 골라 주세요
              </NativeSelectOption>
            )}
            <NativeSelectOption value={WHOLE}>대시보드 전체</NativeSelectOption>
            {list.blocks.map(item => (
              <NativeSelectOption key={item.blockId} value={item.blockId}>
                {chartLabel(item.title)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <p className="report-comment-quote">
          <span className="text-muted-foreground">대상</span> 대시보드 전체
        </p>
      )}
      {missing && <CommentFlag>선택했던 차트를 현재 대시보드에서 찾을 수 없습니다.</CommentFlag>}
      <CommentComposer
        label="새 댓글"
        submit="댓글 남기기"
        autoFocus
        disabled={comments.busy || missing}
        onCancel={() => comments.setDraft(null)}
        send={async (body, requestId) => {
          const ok = await comments.run(() =>
            dashboardCommentApi.createThread(comments.dashboardId, {
              requestId,
              revision: list.revision,
              anchor: draft,
              body,
            }),
          );
          if (ok) comments.setDraft(null);
          return ok;
        }}
      />
    </div>
  );
}

function ThreadNotes({ thread, blocks }: { thread: DashboardThread; blocks: DashboardBlock[] }) {
  if (thread.anchor.kind !== 'block') return null;
  const blockId = thread.anchor.blockId;
  const current = blocks.find(block => block.blockId === blockId);
  return (
    <>
      {thread.location === 'detached' && <CommentFlag>차트 없음 · 분리됨</CommentFlag>}
      {thread.changed && (
        <CommentFlag tone="info">
          변경됨{current && thread.location === 'exact' ? ` · 현재 ${chartLabel(current.title)}` : ''}
        </CommentFlag>
      )}
    </>
  );
}

function PanelBody({
  comments,
  Title,
  Description,
}: {
  comments: DashboardCommentsModel;
  Title: React.ElementType;
  Description: React.ElementType;
}) {
  const { list } = comments;
  return (
    <>
      <div className="flex flex-row items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <Title className="text-base font-semibold">댓글</Title>
          <Description className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {list?.canManage
              ? '모든 스레드를 보고 해결하거나 다시 엽니다.'
              : '내가 시작한 스레드만 보이며 대시보드 편집 권한자도 볼 수 있습니다.'}
          </Description>
        </div>
        <div className="flex shrink-0 gap-1">
          {!comments.unavailable && (
            <Button type="button" size="sm" variant="ghost" disabled={comments.busy} onClick={comments.reload}>
              새로 고침
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" aria-label="댓글 닫기" onClick={comments.close}>
            닫기
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-5 text-sm [overflow-wrap:anywhere]">
        {comments.unavailable ? (
          <p role="status">
            이 대시보드에서는 댓글을 사용할 수 없습니다. 조직 정책이 적용됐거나 접근 권한이 바뀌었을 수 있습니다.
          </p>
        ) : (
          <>
            {!list && !comments.loadError && <p className="text-muted-foreground">댓글을 불러오는 중입니다.</p>}
            {comments.loadError && <p role="alert">{comments.loadError}</p>}
            {comments.error && <p role="alert">{comments.error}</p>}
            {list && !comments.draft && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                disabled={comments.busy}
                onClick={() => comments.setDraft({ kind: 'whole' })}
              >
                새 댓글
              </Button>
            )}
            {list && <NewThread comments={comments} list={list} />}
            {list && !list.threads.length && <p className="text-muted-foreground">아직 댓글이 없습니다.</p>}
            {list && (
              <ol className="report-comment-threads">
                {list.threads.map(thread => {
                  const resolved = thread.status === 'resolved';
                  return (
                    <CommentThreadItem
                      key={thread.id}
                      threadId={thread.id}
                      label={threadLabel(thread)}
                      meta={resolved ? '해결됨' : ''}
                      notes={<ThreadNotes thread={thread} blocks={list.blocks} />}
                      comments={thread.comments}
                      resolved={resolved}
                      active={comments.activeThread === thread.id}
                      busy={comments.busy}
                      onSelect={() => comments.selectThread(thread)}
                      onToggleStatus={
                        list.canManage
                          ? () =>
                              void comments.run(() =>
                                dashboardCommentApi.setStatus(comments.dashboardId, thread.id, {
                                  requestId: crypto.randomUUID(),
                                  status: resolved ? 'open' : 'resolved',
                                  expectedStatusVersion: thread.statusVersion,
                                }),
                              )
                          : undefined
                      }
                      onReply={(body, requestId) =>
                        comments.run(() => dashboardCommentApi.reply(comments.dashboardId, thread.id, { requestId, body }))
                      }
                    />
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function DashboardCommentsPanel({ comments }: { comments: DashboardCommentsModel }) {
  const aside = useRef<HTMLElement>(null);
  // The side panel is not modal, so focus would otherwise stay on the header button and Escape
  // (handled on the panel) could never reach it. A chart-opened draft already focused its textarea.
  useEffect(() => {
    if (comments.modal || !comments.open) return;
    if (!aside.current?.contains(document.activeElement)) aside.current?.focus();
  }, [comments.modal, comments.open]);
  if (comments.modal)
    return (
      <Sheet open={comments.open} onOpenChange={next => (next ? undefined : comments.close())}>
        <SheetContent
          id={PANEL_ID}
          side="right"
          showCloseButton={false}
          aria-label="댓글"
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[400px]"
          onCloseAutoFocus={event => {
            const target = comments.afterClose.current;
            comments.afterClose.current = null;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <PanelBody comments={comments} Title={SheetTitle} Description={SheetDescription} />
        </SheetContent>
      </Sheet>
    );
  return (
    <aside
      ref={aside}
      tabIndex={-1}
      id={PANEL_ID}
      role="complementary"
      aria-label="댓글"
      hidden={!comments.open}
      onKeyDown={event => {
        if (event.key === 'Escape') comments.close();
      }}
      className={cn(
        'fixed top-0 right-0 z-40 h-[100dvh] w-full min-w-0 flex-col border-l border-border bg-background outline-none lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-[400px] [&[hidden]]:hidden',
        comments.open ? 'flex' : 'hidden',
      )}
    >
      <PanelBody comments={comments} Title="h2" Description="p" />
    </aside>
  );
}
