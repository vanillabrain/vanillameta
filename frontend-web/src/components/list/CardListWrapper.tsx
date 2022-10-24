import { Card, Grid } from '@mui/material';
import React from 'react';

const CardListWrapper = ({ children, minWidth }) => {
  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${minWidth || '2, 1fr'})`, lg: `repeat(${minWidth || '4, 1fr'})` },
      }}
    >
      {children}
    </Grid>
  );
};

CardListWrapper.defaultProps = {
  children: '',
  minWidth: false,
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
