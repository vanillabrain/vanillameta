import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

/** One portal subtree preserves unfinished conversations/mapping across responsive layouts. */
export default function StudioPanelSurface({
  compact,
  onClose,
  children,
}: {
  compact: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [target] = useState(() => document.createElement('div'));
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const focusFrame = useRef<number | null>(null);
  const attach = useCallback(
    (host: HTMLDivElement | null) => {
      if (!host) return;
      host.appendChild(target);
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      // Retarget only after the departing Radix focus scope has unmounted.
      focusFrame.current = requestAnimationFrame(() => {
        if (lastFocus.current?.isConnected) lastFocus.current.focus();
      });
    },
    [target],
  );
  useEffect(
    () => () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      // Responsive canvas layout can replace the original trigger DOM node.
      const label = opener?.getAttribute('aria-label');
      const replacement = label
        ? Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
            button => button.getAttribute('aria-label') === label,
          )
        : null;
      const target = opener?.isConnected
        ? opener
        : replacement ?? document.querySelector<HTMLButtonElement>('.studio-context button');
      target?.focus();
    },
    [opener],
  );
  return (
    <>
      {createPortal(
        <div
          className="studio-panel-content"
          onFocusCapture={e => {
            lastFocus.current = e.target as HTMLElement;
          }}
        >
          {children}
        </div>,
        target,
      )}
      {compact ? (
        <Sheet
          open
          onOpenChange={open => {
            if (!open) onClose();
          }}
        >
          <SheetContent
            className="studio-panel-sheet data-[side=right]:w-full sm:data-[side=right]:max-w-md gap-0"
            showCloseButton={false}
            onOpenAutoFocus={e => {
              if (lastFocus.current?.isConnected) {
                e.preventDefault();
                lastFocus.current.focus();
              }
            }}
            onCloseAutoFocus={e => {
              e.preventDefault();
            }}
          >
            <SheetTitle className="sr-only">Studio 보조 패널</SheetTitle>
            <SheetDescription className="sr-only">
              AI 대화와 블록 설정을 편집합니다. Escape로 닫을 수 있습니다.
            </SheetDescription>
            <div className="vm-studio min-h-0 flex-1 overflow-y-auto" ref={attach} />
          </SheetContent>
        </Sheet>
      ) : (
        <div className="studio-panel-host" ref={attach} />
      )}
    </>
  );
}
