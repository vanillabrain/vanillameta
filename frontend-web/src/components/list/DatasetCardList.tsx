import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import { DataSetProps, DataTableProps } from '@/pages/Data/DataLayout';

interface DatasetCardListProps {
  data: DataSetProps[] | DataTableProps[];
  selectedData: DataSetProps | DataTableProps;
  handleDataClick?: (item) => void;
  handleDataRemove?: (item) => void;
  handleModifyClick?: (item) => void;
  className?: string;
  isViewMode?: boolean;
  isTableView?: boolean;
}

export const DatasetCardList = (props: DatasetCardListProps) => {
  const { t } = useTranslation();
  const { data, selectedData, handleDataClick, handleDataRemove, handleModifyClick, isViewMode, isTableView, className } =
    props;

  return (
    <CardListWrapper className={className}>
      {data.length > 0 &&
        data.map(item => {
          const selected = selectedData?.id == item.id;
          const name = item.title || item.tableName;
          return (
            <CardWrapper
              key={item.id}
              handleClick={() => handleDataClick(item)}
              className={cn(
                'min-h-16 flex-row items-center gap-3 px-4 py-3',
                isViewMode && selected && 'border-primary/50 bg-accent/60',
              )}
            >
              <Button
                type="button"
                variant="ghost"
                aria-label={t(isViewMode ? 'data.selectItem' : 'data.previewItem', { name })}
                aria-pressed={isViewMode ? selectedData?.id === item.id : undefined}
                onClick={event => {
                  event.stopPropagation();
                  handleDataClick?.(item);
                }}
                className="h-auto min-w-0 flex-1 justify-start truncate p-0 text-left font-medium text-foreground hover:bg-transparent"
              >
                {name}
              </Button>

              {!isViewMode && (
                <div className="flex shrink-0 flex-row items-center justify-end gap-1">
                  <ModifyButton
                    aria-label={t('data.editItem', { name })}
                    width="20"
                    height="20"
                    fill="#767676"
                    className="p-0"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleModifyClick(item);
                    }}
                  />
                  {!isTableView && (
                    <DeleteButton
                      aria-label={t('data.deleteItem', { name })}
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
                  )}
                </div>
              )}
            </CardWrapper>
          );
        })}
    </CardListWrapper>
  );
};

export default DatasetCardList;
