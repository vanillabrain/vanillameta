import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageTitleBoxProps {
  title: string;
  upperTitle?: string;
  upperTitleLink?: string;
  className?: string;
  button?: React.ReactNode;
  fixed?: boolean;
  children: React.ReactNode;
}

function PageTitleBox(props: PageTitleBoxProps) {
  const { title, upperTitle, upperTitleLink, button, className, fixed, children } = props;
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className={cn('flex w-full shrink-0', fixed && 'sticky top-[108px] z-30 sm:top-16')}>
        <div
          className={cn(
            'flex w-full flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-4 py-5 sm:px-6 sm:py-6',
          )}
        >
          <div className="flex min-w-0 flex-row flex-wrap items-center gap-1.5 sm:gap-2.5">
            {upperTitle && (
              <>
                <RouterLink to={upperTitleLink} className="shrink-0 text-sm font-medium text-muted-foreground no-underline">
                  {upperTitle}
                </RouterLink>
                <span className="shrink-0 text-sm text-muted-foreground">/</span>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={event => {
                event.preventDefault();
                navigate(0);
              }}
              className="h-auto min-w-0 justify-start rounded-none p-0 text-left text-xl leading-8 font-semibold tracking-tight whitespace-normal text-foreground hover:bg-transparent sm:text-2xl"
            >
              {title}
            </Button>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">{button}</div>
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col justify-start">
        <div className={cn('flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 py-6 sm:px-6', className)}>{children}</div>
      </div>
    </div>
  );
}

export default PageTitleBox;
