import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { authorLabel } from './commentModel';
import { CommentNotification, NotificationEvent, commentNotificationApi } from './commentNotificationApi';

export const NOTIFICATION_POLL_MS = 60_000;
/** Returning to the tab fires both focus and visibilitychange; one request covers both. */
const REFRESH_GAP_MS = 2_000;

/** One line per event, after the actor's name. */
const EVENT_TEXT: Record<NotificationEvent, string> = {
  'thread.created': '님이 새 댓글을 남겼습니다',
  'thread.shared': '님이 스레드를 공개했습니다',
  'comment.replied': '님이 답글을 남겼습니다',
  'suggestion.created': '님이 수정 제안을 남겼습니다',
  'suggestion.applied': '님이 수정 제안을 반영했습니다',
  'suggestion.dismissed': '님이 수정 제안을 닫았습니다',
  'thread.resolved': '님이 스레드를 해결했습니다',
  'thread.reopened': '님이 스레드를 다시 열었습니다',
};
export const eventText = (event: NotificationEvent) => EVENT_TEXT[event];

const badge = (count: number) => (count > 99 ? '99+' : String(count));

type UnreadCount = {
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  refresh: (force?: boolean) => Promise<void>;
};
const UnreadContext = createContext<UnreadCount | null>(null);

/**
 * Owns the unread count for every bell under it (the header renders one for desktop and one for
 * mobile), so there is one poll: every minute while the page is visible and on returning to it.
 */
export function CommentNotificationProvider({ children }: { children: ReactNode }) {
  const [count, setValue] = useState(0);
  const mounted = useRef(true);
  const last = useRef(0);
  const refresh = useCallback(async (force = false) => {
    if (document.visibilityState === 'hidden') return;
    if (!force && Date.now() - last.current < REFRESH_GAP_MS) return;
    last.current = Date.now();
    try {
      const next = await commentNotificationApi.unreadCount();
      if (mounted.current) setValue(next);
    } catch {
      // A failed poll keeps the last count; the next tick or focus retries.
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh(true);
    const timer = window.setInterval(() => void refresh(true), NOTIFICATION_POLL_MS);
    const onReturn = () => void refresh();
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [refresh]);
  const value = useMemo(() => ({ count, setCount: setValue, refresh }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

/** Header bell: shows the shared unread count and loads the list only when opened. */
export default function CommentNotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const unread = useContext(UnreadContext);
  if (!unread) throw new Error('CommentNotificationBell needs a CommentNotificationProvider.');
  const { count, setCount, refresh } = unread;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CommentNotification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = async (after?: string) => {
    setError('');
    try {
      const page = await commentNotificationApi.list(after);
      if (!mounted.current) return;
      setItems(current => (after && current ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      if (mounted.current) setError('알림을 불러오지 못했습니다.');
    }
  };

  const toggle = (next: boolean) => {
    setOpen(next);
    if (next) {
      void load();
      void refresh(true);
    }
  };

  const openItem = async (item: CommentNotification) => {
    setOpen(false);
    if (!item.read) {
      setCount(value => Math.max(0, value - 1));
      void commentNotificationApi.markRead({ ids: [item.id] }).catch(() => undefined);
    }
    navigate(`/reports/${item.reportId}/read?thread=${item.threadId}`);
  };

  const readAll = async () => {
    try {
      await commentNotificationApi.markRead({ all: true });
      if (!mounted.current) return;
      setCount(0);
      setItems(current => current?.map(item => ({ ...item, read: true })) ?? current);
    } catch {
      if (mounted.current) setError('읽음 처리를 하지 못했습니다.');
    }
  };

  const label = count ? `댓글 알림, 읽지 않은 알림 ${badge(count)}개` : '댓글 알림';
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" aria-label={label} className={`relative size-9 p-0 ${className ?? ''}`}>
          <Bell className="size-5" aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[11px] leading-[18px] font-semibold text-primary-foreground"
            >
              {badge(count)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="댓글 알림" className="w-[min(360px,calc(100vw-24px))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">댓글 알림</h2>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={readAll} disabled={!count}>
            모두 읽음
          </Button>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
          {error && (
            <p role="alert" className="px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {items === null && !error && (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">
              불러오는 중입니다.
            </p>
          )}
          {items?.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">새 알림이 없습니다.</p>}
          {!!items?.length && (
            <ul className="divide-y">
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="grid w-full gap-1 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex items-start gap-2 text-sm">
                      {!item.read && (
                        <>
                          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                          <span className="sr-only">읽지 않음</span>
                        </>
                      )}
                      <span className="min-w-0 break-words">
                        <strong className="font-semibold">{authorLabel(item.actor)}</strong> {eventText(item.event)}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.title} · {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <Button type="button" variant="ghost" className="w-full rounded-none text-xs" onClick={() => load(cursor)}>
              이전 알림 더 보기
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
