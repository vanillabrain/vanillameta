import { Stack, SxProps, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import React from 'react';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import { DataSetProps, DataTableProps } from '@/pages/Data/DataLayout';

interface DatasetCardListProps {
  data: DataSetProps[] | DataTableProps[];
  selectedDataset: DataSetProps | DataTableProps;
  handleDataSetClick: (item) => void;
  handleDataSetRemove?: (item) => void;
  sx?: SxProps;
}

const CardListWrapper = props => {
  const { children } = props;
  return (
    <Stack
      component="ul"
      sx={{
        display: { xs: 'flex', md: 'grid' },
        gridTemplateColumns: { xs: 'repeat(100%)', sm: 'repeat(auto-fit, minmax(0, 228px))' },
        gap: '8px',
        minHeight: '20px',
        listStyle: 'none',
        pl: 0,
      }}
    >
      {children}
    </Stack>
  );
};

const selectedSx = { border: 'solid 1px #4481c9', backgroundColor: '#edf8ff' };

export const DatasetCardList = (props: DatasetCardListProps) => {
  const { data, selectedDataset, handleDataSetClick, handleDataSetRemove, sx } = props;
  console.log(data);
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
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '2px 2px 6px 0 rgba(0, 42, 105, 0.1)',
                border: 'solid 1px #ddd',
                backgroundColor: '#fff',
                '&:hover': { backgroundColor: '#ebfbff' },
                ...(selectedDataset?.id == item.id && selectedSx),
              }}
              onClick={() => handleDataSetClick(item)}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title || item.tableName}
              </Typography>

              {/* 아이콘 */}
              {handleDataSetRemove && (
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
                    size="medium"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDataSetRemove(item);
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
