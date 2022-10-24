import { Grid } from '@mui/material';
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
        gridTemplateColumns: { xs: '1fr', md: `repeat(${minWidth || '3, 1fr'})` },
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
