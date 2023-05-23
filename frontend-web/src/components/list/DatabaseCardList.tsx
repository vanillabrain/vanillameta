import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { DatabaseProps } from '@/pages/Data/DataLayout';
import { ReactComponent as IconDatabase } from '@/assets/images/icon/ic-data.svg';

interface DatabaseCardListProps {
  data: DatabaseProps[];
  selectedData: DatabaseProps;
  handleDataClick?: (item) => void;
  handleDataRemove?: (item) => void;
  isViewMode?: boolean;
  icon?: React.ReactNode;
}

const selectedSx = { border: 'solid 1px #0f5ab2', backgroundColor: '#edf8ff' };
const selectedIconSx = { fill: '#0f5ab2' };
const selectedTypoSx = { fontWeight: 'bold', color: '#0f5ab2' };

export const DatabaseCardList = (props: DatabaseCardListProps) => {
  const { data, selectedData, handleDataClick, handleDataRemove, isViewMode, icon = <IconDatabase /> } = props;

  return (
    <CardListWrapper sx={{ gridTemplateColumns: 'repeat(100%)' }}>
      {data.length > 0 &&
        data.map(item => (
          <CardWrapper
            key={item.id}
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              height: '62px',
              ...(selectedData?.id == item.id && selectedSx),
            }}
            handleClick={() => handleDataClick(item)}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mr: '8px',
                fill: '#767676',
                ...(selectedData?.id == item.id && selectedIconSx),
              }}
            >
              {icon}
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
                ...(selectedData?.id == item.id && selectedTypoSx),
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
          </CardWrapper>
        ))}
    </CardListWrapper>
  );
};
