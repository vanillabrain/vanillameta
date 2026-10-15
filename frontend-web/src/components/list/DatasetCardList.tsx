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
              className={cn('max-h-[90px]', isViewMode && selected && 'border-[#0f5ab2] bg-[#edf8ff]')}
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
                className="h-auto w-full min-w-0 justify-start truncate px-0 text-left font-medium text-[#333] hover:bg-transparent"
              >
                {name}
              </Button>

              {!isViewMode && (
                <div className="mt-[11px] flex w-full flex-row items-center justify-end gap-2">
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
