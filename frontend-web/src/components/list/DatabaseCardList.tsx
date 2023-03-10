import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CardListWrapper from '@/components/list/CardListWrapper';
import { ReactComponent as IconDatabase } from '@/assets/images/icon/ic-data.svg';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { DatabaseProps } from '@/pages/Data/DataLayout';

interface DatabaseCardListProps {
  data: DatabaseProps[];
  selectedData: DatabaseProps;
  handleDataClick?: (item) => void;
  handleDataRemove?: (item) => void;
  isViewMode?: boolean;
}

const selectedSx = { border: 'solid 1px #0f5ab2', backgroundColor: '#edf8ff' };

export const DatabaseCardList = (props: DatabaseCardListProps) => {
  const { data, selectedData, handleDataClick, handleDataRemove, isViewMode } = props;

  return (
    <CardListWrapper sx={{ gridTemplateColumns: 'repeat(100%)' }}>
      {data.length > 0 &&
        data.map(item => (
          <Stack component="li" key={item.id} sx={{ flex: '1 1 auto' }}>
            <Stack
              component="button"
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                height: '62px',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '2px 2px 6px 0 rgba(0, 42, 105, 0.1)',
                border: 'solid 1px #ddd',
                backgroundColor: '#fff',
                '&:hover': { backgroundColor: '#ebfbff' },
                ...(selectedData?.id == item.id && selectedSx),
              }}
              onClick={() => handleDataClick(item)}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mr: '8px',
                }}
              >
                <IconDatabase />
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  flex: 1,
                  width: '100%',
                  mr: '18px',
                  textAlign: 'left',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  color: '#333',
                }}
              >
                {item.name}
              </Typography>

              {!isViewMode && (
                <Stack direction="row" justifyContent="flex-end" width="100%" flex={0}>
                  <ModifyButton
                    size="medium"
                    component={RouterLink}
                    to={`/data/source/modify/${item.id}`}
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
