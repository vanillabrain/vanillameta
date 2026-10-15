import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import DeleteButton from '@/components/button/DeleteButton';
import { DatabaseProps } from '@/pages/Data/DataLayout';
import IconDatabase from '@/assets/images/icon/ic-data.svg?react';
import IconEdit from '@/assets/images/icon/pen-to-square.svg?react';

interface DatabaseCardListProps {
  data: DatabaseProps[];
  selectedData: DatabaseProps;
  handleDataClick?: (item) => void;
  handleDataRemove?: (item) => void;
  isViewMode?: boolean;
  icon?: React.ReactNode;
}

export const DatabaseCardList = (props: DatabaseCardListProps) => {
  const { t } = useTranslation();
  const { data, selectedData, handleDataClick, handleDataRemove, isViewMode, icon = <IconDatabase /> } = props;

  return (
    <CardListWrapper layout="stack">
      {data.length > 0 &&
        data.map(item => {
          const selected = selectedData?.id == item.id;
          return (
            <CardWrapper
              key={item.id}
              handleClick={() => handleDataClick(item)}
              className={cn('min-h-16 flex-row items-center gap-3 px-4 py-3', selected && 'border-primary/50 bg-accent/60')}
            >
              <span className={cn('flex size-5 shrink-0 items-center text-muted-foreground', selected && 'text-primary')}>
                {icon}
              </span>
              <Button
                type="button"
                variant="ghost"
                aria-label={t('data.selectSource', { name: item.name })}
                aria-pressed={selected}
                onClick={event => {
                  event.stopPropagation();
                  handleDataClick?.(item);
                }}
                className={cn(
                  'h-auto min-w-0 flex-1 justify-start truncate p-0 text-left font-medium text-foreground hover:bg-transparent',
                  selected && 'font-bold text-primary',
                )}
              >
                {item.name}
              </Button>

              {!isViewMode && (
                <div className="flex shrink-0 flex-row items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon-sm" className="p-0">
                    <RouterLink
                      to={'/data/source/modify/' + item.id}
                      aria-label={t('data.editItem', { name: item.name })}
                      onClick={event => event.stopPropagation()}
                      className="text-[#767676]"
                    >
                      <IconEdit width="20" height="20" fill="currentColor" />
                    </RouterLink>
                  </Button>
                  <DeleteButton
                    aria-label={t('data.deleteItem', { name: item.name })}
                    width="20"
                    height="20"
                    fill="#767676"
                    className="p-0"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDataRemove(item);
                    }}
                  />
                </div>
              )}
            </CardWrapper>
          );
        })}
    </CardListWrapper>
  );
};

export default DatabaseCardList;
