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
              className={cn(
                'h-[62px] min-h-[62px] flex-row items-center gap-2 py-0',
                selected && 'border-[#0f5ab2] bg-[#edf8ff]',
              )}
            >
              <span className={cn('mr-2 flex items-center text-[#767676]', selected && 'text-[#0f5ab2]')}>{icon}</span>
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
                  'h-auto min-w-0 flex-1 justify-start truncate px-0 text-left font-medium text-[#333] hover:bg-transparent',
                  selected && 'font-bold text-[#0f5ab2]',
                )}
              >
                {item.name}
              </Button>

              {!isViewMode && (
                <div className="flex shrink-0 flex-row items-center justify-end gap-[18px]">
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
