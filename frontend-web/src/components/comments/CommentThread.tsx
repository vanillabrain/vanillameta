import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentAuthor, CommentEntry, authorLabel } from './commentModel';
import './comments.css';

const BODY_LIMIT = 4000;
const time = (value: string) => new Date(value).toLocaleString();

export function AuthorName({ author }: { author: CommentAuthor }) {
  return <strong data-author-kind={author.kind}>{authorLabel(author)}</strong>;
}

/** A note about where the anchor stands now; `info` is a neutral change, `warning` a lost target. */
export function CommentFlag({ tone = 'warning', children }: { tone?: 'warning' | 'info'; children: React.ReactNode }) {
  return (
    <span className="report-comment-flag" data-tone={tone}>
      {children}
    </span>
  );
}

/** Text input whose requestId survives a failed send, so retrying the same text is a safe replay. */
export function CommentComposer({
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

/**
 * One thread as a list item: target, location notes, comments, resolve/reopen and reply. Anchor
 * semantics stay with the caller, which passes the label and notes already worded.
 */
export function CommentThreadItem({
  threadId,
  label,
  meta,
  notes,
  comments,
  resolved,
  active,
  busy,
  onSelect,
  onToggleStatus,
  onReply,
  extraActions,
  editor,
  children,
}: {
  threadId: string;
  label: string;
  meta?: React.ReactNode;
  notes?: React.ReactNode;
  comments: CommentEntry[];
  resolved: boolean;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  /** Omit when the viewer may not change the thread status. */
  onToggleStatus?: () => void;
  onReply: (body: string, requestId: string) => Promise<boolean>;
  extraActions?: React.ReactNode;
  /** Replaces the action row while the caller shows its own inline form. */
  editor?: React.ReactNode;
  /** Rendered after the comments, e.g. suggestions. */
  children?: React.ReactNode;
}) {
  return (
    <li
      id={`comment-thread-${threadId}`}
      className="report-comment-thread"
      data-active={active || undefined}
      aria-label={`댓글 스레드 ${label}`}
    >
      <button type="button" className="report-comment-target" onClick={onSelect}>
        <span className="report-comment-anchor">{label}</span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </button>
      {notes}
      <ol className="report-comment-list">
        {comments.map(comment => (
          <li key={comment.id}>
            <p className="report-comment-meta">
              <AuthorName author={comment.author} /> · {time(comment.createdAt)}
            </p>
            <p className="report-comment-body">{comment.body}</p>
          </li>
        ))}
      </ol>
      {children}
      {editor || (
        <div className="report-comment-actions">
          {extraActions}
          {onToggleStatus && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onToggleStatus}>
              {resolved ? '다시 열기' : '해결'}
            </Button>
          )}
        </div>
      )}
      <CommentComposer label="답글" submit="답글 남기기" disabled={busy} send={onReply} />
    </li>
  );
}
