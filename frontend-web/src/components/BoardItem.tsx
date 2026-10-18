import React from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { dateData } from '@/utils/util';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BoardItemDataProps {
  id: string | number;
  title: string;
  updatedAt: string;
  componentType?: string;
  icon?: string;
}

interface BoardItemProps {
  data: BoardItemDataProps;
  handleDeleteSelect: (id, title) => void;
  studioHref?: string;
  showStudioColumn?: boolean;
  archiveAction?: { label: string; disabled?: boolean; onClick: () => void };
}

const TitleSpan = ({ children, className = '' }) => (
  <span className={cn('block w-full truncate text-sm leading-tight font-semibold text-foreground', className)}>
    {children}
  </span>
);

const SubTitleSpan = ({ children, className = '' }) => (
  <span className={cn('flex items-center justify-between text-xs leading-5 text-foreground', className)}>{children}</span>
);

const IconRowHeader = ({ icon }) => (
  <span className="mr-3 flex w-6 shrink-0 items-center justify-center">
    <img src={'static/images/' + icon} alt="" className="h-[30px] w-auto rounded-none bg-transparent object-contain" />
  </span>
);

function BoardItem(props: BoardItemProps) {
  const { data, handleDeleteSelect, studioHref, showStudioColumn, archiveAction } = props;
  const { id, title, componentType, icon, updatedAt } = data;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <li
      className={cn(
        'flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:px-5',
        archiveAction && 'flex-wrap',
      )}
    >
      <RouterLink
        className="flex min-h-8 min-w-0 flex-1 flex-row items-center justify-between gap-3"
        to={String(id)}
        state={{ from: pathname }}
      >
        <span className="flex min-w-0 flex-1 flex-row items-center">
          {componentType && <IconRowHeader icon={icon} />}
          <TitleSpan className="sm:truncate">{title}</TitleSpan>
        </span>
        <span className="flex shrink-0 flex-row items-center">
          <SubTitleSpan className="text-muted-foreground">{dateData(updatedAt)}</SubTitleSpan>
        </span>
      </RouterLink>
      {studioHref && (
        <Button asChild variant="outline" size="sm" className="w-24 shrink-0">
          <RouterLink to={studioHref} aria-label={title + ' · Studio 열기'}>
            Studio 열기
          </RouterLink>
        </Button>
      )}
      {!studioHref && showStudioColumn && <span className="w-24 shrink-0" aria-hidden="true" />}
      {archiveAction && (
        <Button
          size="sm"
          variant="outline"
          className="max-w-full whitespace-normal break-words text-sm"
          disabled={archiveAction.disabled}
          aria-label={title + ' · ' + archiveAction.label}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            archiveAction.onClick();
          }}
        >
          {archiveAction.label}
        </Button>
      )}
      <span className="hidden shrink-0 items-center gap-2 sm:ml-5 sm:flex">
        <ModifyButton
          aria-label={title + ' · 수정'}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            navigate('modify?id=' + id + '&title=' + title, { state: { from: pathname } });
          }}
        />
        <DeleteButton
          aria-label={title + ' · 삭제'}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            handleDeleteSelect(id, title);
          }}
        />
      </span>
    </li>
  );
}

export default BoardItem;
