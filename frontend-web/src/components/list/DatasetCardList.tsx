import { Stack, SxProps, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import React from 'react';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import { DataSetProps, DataTableProps } from '@/pages/Data/DataLayout';

interface DatasetCardListProps {
  data: DataSetProps[] | DataTableProps[];
  selectedData: DataSetProps | DataTableProps;
  handleDataClick?: (item) => void;
  handleDataRemove?: (item) => void;
  sx?: SxProps;
  isViewMode?: boolean;
}

const selectedSx = { border: 'solid 1px #0f5ab2', backgroundColor: '#edf8ff' };

export const DatasetCardList = (props: DatasetCardListProps) => {
  const { data, selectedData, handleDataClick, handleDataRemove, isViewMode } = props;

  return (
    <CardListWrapper>
      {data.length > 0 &&
        data.map(item => (
          <CardWrapper
            id={item.id}
            sx={{
              maxHeight: '90px',
              ...(isViewMode && selectedData?.id == item.id && selectedSx),
            }}
            handleClick={() => handleDataClick(item)}
          >
            <Typography
              variant="subtitle2"
              sx={{
                width: '100%',
                textAlign: 'left',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: '#333',
              }}
            >
              {item.title || item.tableName}
            </Typography>

            {/* 아이콘 */}
            {handleDataRemove && (
              <Stack direction="row" justifyContent="flex-end" width="100%" mt="11px">
                <ModifyButton
                  size="medium"
                  component={RouterLink}
                  to={`/data/set/modify/${item.id}`}
                  width="20"
                  height="20"
                  padding="0"
                  fill="#767676"
                  sx={{ p: 0, mr: '18px' }}
                />
                <DeleteButton
                  component="span"
                  size="medium"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDataRemove(item);
                  }}
                  width="20"
                  height="20"
                  fill="#767676"
                  sx={{ p: 0 }}
                />
              </Stack>
            )}
          </CardWrapper>
        ))}
    </CardListWrapper>
  );
};
