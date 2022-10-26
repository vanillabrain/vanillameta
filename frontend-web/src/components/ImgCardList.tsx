import React from 'react';
import { Box, CardContent, Grid, Typography } from '@mui/material';
import { CardWrapper } from '@/components/list/CardListWrapper';

function ImgCardList(props) {
  const { data, minWidth, selectedType, setSelectedType } = props;
  const srcUrl = '/static/images/';

  const handleClick = item => {
    console.log('database : ', item);
    setSelectedType(item);
  };

  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: `repeat(${minWidth || '4, 1fr'})`,
          md: `repeat(${minWidth || '6, 1fr'})`,
          lg: `repeat(${minWidth || '8, 1fr'})`,
          xl: `repeat(${minWidth || '10, 1fr'})`,
        },
      }}
    >
      {data.map(item => {
        const selected = selectedType && selectedType.id === item.id;
        return (
          <Grid item xs={12} md component="li" key={item.id}>
            {/*// <Box component="li" key={item.id} sx={{ width: '166px', height: '169px' }}>*/}
            <CardWrapper sx={{ p: 0 }} selected={selected} onClick={() => handleClick(item)}>
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 169,
                }}
              >
                <Box
                  component="img"
                  src={srcUrl + item.icon}
                  sx={{ width: 80, height: 60, objectFit: 'contain', mb: 3, border: 0 }}
                />
                <Typography
                  variant="subtitle2"
                  component="span"
                  sx={{ textAlign: 'center', lineHeight: '1.3', fontWeight: 'bold' }}
                >
                  {item.title}
                </Typography>
                {item.description ? (
                  <Typography
                    variant="caption"
                    sx={{ mt: '4px', textAlign: 'center', lineHeight: '1.3', color: theme => theme.palette.grey.A700 }}
                  >
                    {item.description}
                  </Typography>
                ) : (
                  ' '
                )}
              </CardContent>
            </CardWrapper>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default ImgCardList;
