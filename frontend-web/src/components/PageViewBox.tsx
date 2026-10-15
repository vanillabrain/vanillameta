import React, { useContext, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { LayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

const SM_BREAKPOINT = 600;

/** Mirrors the Tailwind sm breakpoint so layout branches stay in one tree per viewport. */
export const useMinWidth = (minWidth: number) => {
  const query = '(min-width: ' + minWidth + 'px)';
  const getMatches = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia(query).matches;
  };
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = event => setMatches(event.matches);
    if (list.addEventListener) {
      list.addEventListener('change', onChange);
    } else {
      list.addListener(onChange);
    }
    return () => {
      if (list.removeEventListener) {
        list.removeEventListener('change', onChange);
      } else {
        list.removeListener(onChange);
      }
    };
  }, [query]);

  return matches;
};

interface PageViewBoxProps {
  iconName?: string;
  title?: string;
  titleElement?: React.ReactNode;
  date?: string;
  button?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  preserveChildren?: boolean;
}

const IconAvatar = ({ iconName, title, className = '' }) => {
  const fallbackText = String(title ?? iconName ?? '')
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <Avatar className={cn('size-[30px] rounded-none bg-transparent after:hidden', className)}>
      <AvatarImage src={'/static/images/' + iconName} alt="" className="rounded-none object-contain" />
      <AvatarFallback className="rounded-none bg-muted text-sm font-semibold text-muted-foreground">
        {fallbackText || '•'}
      </AvatarFallback>
    </Avatar>
  );
};

function PageViewBox(props: PageViewBoxProps) {
  const matches = useMinWidth(SM_BREAKPOINT);
  if (props.preserveChildren) return <DesktopViewBox {...props} responsive />;
  return matches ? <DesktopViewBox {...props} /> : <MobileViewBox {...props} />;
}
export default PageViewBox;

const MobileViewBox = props => {
  const { iconName, title, titleElement, date, button, className } = props;
  const { changeFooterBg } = useContext(LayoutContext);

  useEffect(() => {
    if (changeFooterBg) {
      changeFooterBg('#f9f9fa');
    }
    return () => {
      if (changeFooterBg) {
        changeFooterBg(null);
      }
    };
  }, [changeFooterBg]);

  return (
    <div data-slot="page-view-mobile" className={cn('flex w-full flex-1 flex-col items-center', className)}>
      <div className="flex min-h-[66px] w-full flex-wrap items-center justify-between gap-2 bg-card px-5 pb-3">
        <div className="flex w-full min-w-0 flex-row items-center">
          {iconName && <IconAvatar iconName={iconName} title={title} className="mr-3" />}
          <div className="mt-[18px] mb-2.5 flex flex-col gap-1">
            {titleElement ? (
              titleElement
            ) : (
              <span className="line-clamp-3 max-h-[60px] overflow-hidden pr-3 text-base leading-[1.3] font-semibold break-words text-[#333]">
                {title}
              </span>
            )}
            {date && <span className="text-[10px] leading-[1.6] font-medium text-[#333]">수정일: {date}</span>}
          </div>
        </div>
        {button}
      </div>
      <div className="h-full w-full min-w-full flex-1 bg-muted">
        <Separator className="h-px w-full" />
        {props.children}
      </div>
    </div>
  );
};

const DesktopViewBox = props => {
  const { iconName, title, titleElement, date, button, className, responsive } = props;

  return (
    <div
      data-slot="page-view-desktop"
      className={cn('flex w-full flex-col items-center', responsive ? 'px-0 sm:px-5' : 'px-5', className)}
    >
      <div
        className={cn(
          'h-full w-full max-w-[1392px] bg-muted',
          responsive ? 'rounded-none sm:rounded-md sm:border sm:border-border' : 'rounded-md border border-border',
        )}
      >
        <div
          className={cn(
            'flex w-full items-center justify-between rounded-t-md bg-card px-5',
            responsive
              ? 'h-auto flex-wrap gap-1 py-1.5 lg:h-[57px] lg:flex-nowrap lg:gap-0 lg:py-0'
              : 'h-[57px] flex-nowrap',
          )}
        >
          <div
            className={cn(
              'flex w-full min-w-0 flex-row items-center',
              responsive ? 'max-w-full lg:max-w-[calc(100%-100px)]' : 'max-w-[calc(100%-100px)]',
            )}
          >
            {iconName && <IconAvatar iconName={iconName} title={title} className="mr-[18px]" />}
            {titleElement ? (
              titleElement
            ) : (
              <span className="block w-full max-w-[1392px] truncate text-base leading-none font-medium tracking-tight text-foreground sm:text-lg">
                {title}
              </span>
            )}
          </div>
          <div
            className={cn(
              'flex shrink-0 justify-end',
              responsive
                ? 'w-full flex-col items-start gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-0'
                : 'w-auto flex-row items-center',
            )}
          >
            <span
              className={cn(
                'h-4 text-sm leading-tight font-medium text-foreground',
                button && 'text-right sm:mr-[26px] md:mr-[36px]',
              )}
            >
              {date}
            </span>
            <div
              className={cn('flex flex-row flex-wrap items-center justify-end', responsive ? 'w-full lg:w-auto' : 'w-auto')}
            >
              {button}
            </div>
          </div>
        </div>
        <Separator className="h-px w-full" />
        {props.children}
      </div>
    </div>
  );
};
