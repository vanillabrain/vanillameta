import { Card, Stack } from '@mui/material';
import React from 'react';

export const CardListWrapper = props => {
  const { children, sx } = props;
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
        ...sx,
      }}
    >
      {children}
    </Stack>
  );
};

export default CardListWrapper;

export const CardWrapper = ({ children, selected, onClick, sx = null }) => {
  return (
    <Card
      sx={{
        padding: '20px 8px 20px 21px',
        borderRadius: '8px',
        boxShadow: '2px 2px 6px 0 rgba(0, 42, 105, 0.1)',
        border: selected ? 'solid 1px #4481c9' : 'solid 1px #ddd',
        backgroundColor: selected ? '#edf8ff' : '#fff',
        cursor: 'pointer',
        position: 'relative',
        alignItems: 'center',
        '&:hover': {
          backgroundColor: '#ebfbff',
        },
        ...sx,
      }}
      onClick={onClick}
    >
      {children}
    </Card>
  );
};

CardListWrapper.defaultProps = {
  children: '',
  minWidth: false,
};
