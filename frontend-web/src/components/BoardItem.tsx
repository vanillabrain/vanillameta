import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { dateData } from '@/utils/util';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';

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
  display?: 'list' | 'grid';
}

const TitleSpan = ({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => (
  <span title={title} className={cn('block w-full truncate text-sm leading-tight font-semibold text-foreground', className)}>
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
  const { t } = useTranslation();
  const { data, handleDeleteSelect, studioHref, showStudioColumn, archiveAction, display = 'list' } = props;
  const { id, title, componentType, icon, updatedAt } = data;
  const navigate = useNavigate();
  const location = useLocation();
  const { link: artifactLink } = artifactListNavigation(location);
  const pathname = location.pathname;
  const grid = display === 'grid';

  return (
    <li
      className={cn(
        grid
          ? 'flex min-w-0 flex-col items-start gap-2 rounded-xl border border-border bg-card p-4'
          : 'flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:px-5',
        !grid && archiveAction && 'flex-wrap',
      )}
    >
      <RouterLink
        className={cn(
          'min-h-8 min-w-0 rounded-md',
          grid ? 'flex w-full flex-col items-start gap-2' : 'flex flex-1 flex-row items-center justify-between gap-3',
        )}
        to={artifactLink(String(id))}
        state={{ from: pathname + location.search }}
        aria-label={grid ? title + ' · ' + t('artifact.view') : undefined}
      >
        {grid && (
          <span className="flex h-32 w-full items-center justify-center rounded-lg bg-muted">
            <LayoutDashboard aria-hidden="true" className="size-9 text-muted-foreground" />
          </span>
        )}
        <span className={cn('flex min-w-0 flex-row items-center', grid ? 'w-full items-start' : 'flex-1')}>
          {componentType && <IconRowHeader icon={icon} />}
          <TitleSpan
            title={grid ? title : undefined}
            className={grid ? 'line-clamp-2 whitespace-normal break-words text-base leading-snug' : 'sm:truncate'}
          >
            {title}
          </TitleSpan>
        </span>
        <span className="flex shrink-0 flex-row items-center">
          <SubTitleSpan className="text-muted-foreground">
            {grid && `${t(studioHref ? 'artifact.analysis' : 'artifact.dashboard')} · ${t('artifact.modified')} · `}
            {dateData(updatedAt)}
          </SubTitleSpan>
        </span>
      </RouterLink>
      {grid && (
        <Button asChild variant="outline" size="lg" className="w-30">
          <RouterLink
            to={artifactLink(String(id))}
            state={{ from: pathname + location.search }}
            aria-label={title + ' · ' + t('artifact.open')}
          >
            {t('artifact.open')}
          </RouterLink>
        </Button>
      )}
      {studioHref && (
        <Button asChild variant="outline" size={grid ? 'lg' : 'sm'} className={grid ? 'w-30 shrink-0' : 'w-24 shrink-0'}>
          <RouterLink
            to={artifactLink(studioHref)}
            state={{ from: pathname + location.search }}
            aria-label={title + ' · ' + t('artifact.studio')}
          >
            {t('artifact.studio')}
          </RouterLink>
        </Button>
      )}
      {!grid && !studioHref && showStudioColumn && <span className="w-24 shrink-0" aria-hidden="true" />}
      {archiveAction && (
        <Button
          size={grid ? 'lg' : 'sm'}
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
      <span
        className={cn(
          'shrink-0 items-center gap-2',
          grid ? 'mt-auto flex w-full justify-end border-t border-border pt-4' : 'hidden sm:ml-5 sm:flex',
        )}
      >
        <ModifyButton
          className={grid ? 'h-10 w-10' : undefined}
          aria-label={title + ' · ' + t('artifact.rename')}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            navigate('modify?id=' + id + '&title=' + title, { state: { from: pathname } });
          }}
        />
        <DeleteButton
          className={grid ? 'h-10 w-10' : undefined}
          aria-label={title + ' · ' + t('artifact.delete')}
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
