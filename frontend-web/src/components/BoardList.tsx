import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import BoardItem from './BoardItem';
import { MAX_WIDTH } from '@/constant';

const PAGE_SIZE = 10;
const WINDOW = 5;

const GTSpan = ({ children, className = '' }) => (
  <span className={cn('text-xs leading-5 font-medium text-muted-foreground', className)}>{children}</span>
);

function BoardList(props) {
  const { t } = useTranslation();
  const { postList, handleDeleteSelect, className, studioHrefForItem } = props;
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTotalCount(Math.ceil(postList.length / PAGE_SIZE));
  }, [postList]);

  const handlePageChange = (event, targetPage) => {
    event.preventDefault();
    if (targetPage < 1 || (totalCount > 0 && targetPage > totalCount)) {
      return;
    }
    setPage(targetPage);
  };

  const firstPage = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), Math.max(1, totalCount - WINDOW + 1)));
  const pages = Array.from(
    { length: Math.max(0, Math.min(WINDOW, totalCount - firstPage + 1)) },
    (_, index) => firstPage + index,
  );

  return (
    <div className={cn('mx-auto w-full', className)} style={{ maxWidth: MAX_WIDTH }}>
      <div className="mb-3 mt-6 flex w-full flex-row items-center gap-3 px-4 sm:px-5">
        <GTSpan className="min-w-0 flex-1">{t('settings.name')}</GTSpan>
        <GTSpan>{t('common.modified')}</GTSpan>
        {studioHrefForItem && <span className="w-24 shrink-0" aria-hidden="true" />}
        <span className="hidden w-18 shrink-0 sm:ml-5 sm:block" aria-hidden="true" />
      </div>
      <ul className="w-full rounded-lg border border-border bg-card p-0">
        {postList.map((item, index) => {
          const currentPageStart = (page - 1) * PAGE_SIZE;
          if (index < currentPageStart || index >= currentPageStart + PAGE_SIZE) {
            return null;
          }
          return (
            <BoardItem
              data={item}
              key={item.id}
              handleDeleteSelect={handleDeleteSelect}
              studioHref={studioHrefForItem?.(item)}
              showStudioColumn={!!studioHrefForItem}
            />
          );
        })}
      </ul>
      <div className="mt-6 flex justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                aria-disabled={page <= 1}
                className={cn(page <= 1 && 'pointer-events-none opacity-50')}
                onClick={event => handlePageChange(event, page - 1)}
              />
            </PaginationItem>
            {pages.map(targetPage => (
              <PaginationItem key={targetPage}>
                <PaginationLink
                  href="#"
                  isActive={targetPage === page}
                  onClick={event => handlePageChange(event, targetPage)}
                >
                  {targetPage}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                text=""
                aria-disabled={page >= totalCount}
                className={cn(page >= totalCount && 'pointer-events-none opacity-50')}
                onClick={event => handlePageChange(event, page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export default BoardList;
