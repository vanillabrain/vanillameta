import { Stack, SxProps, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import React from 'react';
import CardListWrapper from '@/components/list/CardListWrapper';
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
          <Stack component="li" key={item.id} sx={{ flex: '1 1 auto' }}>
            <Stack
              component="button"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90px',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '2px 2px 6px 0 rgba(0, 42, 105, 0.1)',
                border: 'solid 1px #ddd',
                backgroundColor: '#fff',
                '&:hover': { backgroundColor: '#ebfbff' },
                ...(isViewMode && selectedData?.id == item.id && selectedSx),
              }}
              onClick={() => handleDataClick(item)}
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
            </Stack>
          </Stack>
        ))}
    </CardListWrapper>
  );
};
