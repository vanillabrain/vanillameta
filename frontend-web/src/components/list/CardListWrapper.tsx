import { Stack, SxProps } from '@mui/material';
import React from 'react';

interface CardListWrapperProps {
  children: React.ReactNode;
  sx?: SxProps;
}

interface CardWrapperProps {
  children: React.ReactNode;
  sx?: SxProps;
  handleClick?: (item) => void;
}

export const CardListWrapper = (props: CardListWrapperProps) => {
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

export const CardWrapper = (props: CardWrapperProps) => {
  const { children, sx, handleClick } = props;

  return (
    <Stack component="li" sx={{ flex: '1 1 auto' }}>
      <Stack
        component={handleClick ? 'button' : 'div'}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '2px 2px 6px 0 rgba(0, 42, 105, 0.1)',
          border: 'solid 1px #ddd',
          backgroundColor: '#fff',
          ...(handleClick ? { '&:hover': { backgroundColor: '#ebfbff' } } : {}),
          ...sx,
        }}
        onClick={handleClick}
      >
        {children}
      </Stack>
    </Stack>
  );
};
