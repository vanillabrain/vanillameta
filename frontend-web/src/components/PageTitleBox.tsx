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
    <div className="flex h-full w-full flex-1 flex-col">
      <div className="flex w-full">
        <div
          className={cn(
            'flex w-full flex-wrap items-center justify-between gap-y-2 border-b border-border bg-muted px-6 py-2 sm:h-14 sm:min-h-14 sm:flex-nowrap sm:py-0',
            fixed && 'fixed z-30',
          )}
        >
          <div className="flex flex-row items-center gap-1.5 sm:gap-2.5">
            {upperTitle && (
              <>
                <RouterLink
                  to={upperTitleLink}
                  className="h-[19px] shrink-0 text-sm font-medium text-muted-foreground no-underline sm:text-base"
                >
                  {upperTitle}
                </RouterLink>
                <span className="h-[19px] shrink-0 text-sm font-medium text-muted-foreground sm:text-base">/</span>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={event => {
                event.preventDefault();
                navigate(0);
              }}
              className="h-[19px] shrink-0 justify-start rounded-none px-0 text-left text-sm font-semibold text-foreground hover:bg-transparent sm:text-base"
            >
              {title}
            </Button>
          </div>
          <div className="flex max-w-full flex-wrap gap-2 sm:contents">{button}</div>
        </div>
      </div>
      <div className="flex h-[calc(100%-56px)] w-full flex-1 flex-col justify-start">
        <div className={cn('h-full w-full flex-1 px-[25px]', className)}>{children}</div>
      </div>
    </div>
  );
}

export default PageTitleBox;
