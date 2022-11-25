import React from 'react';
import { Box, CardContent, Typography } from '@mui/material';
import { CardWrapper } from '@/components/list/CardListWrapper';

function LargeImgCardList(props) {
  const { data, selectedType, setSelectedType } = props;
  const srcUrl = '/static/images/';

  const handleClick = item => {
    console.log('database : ', item);
    setSelectedType(item);
  };

  return (
    <Box
      component="ul"
      sx={{
        display: 'grid',
        listStyle: 'none',
        pl: 0,
        gridTemplateColumns: 'repeat(auto-fit, minmax(0, 169px))',
        justifyContent: 'center',
        gap: '20px',
        m: '0',
      }}
    >
      {data
        .filter(item => item.seq !== null)
        .sort((a, b) => a.seq - b.seq)
        .map(item => {
          const selected = selectedType && selectedType.id === item.id;
          return (
            <Box component="li" key={item.id}>
              <CardWrapper sx={{ width: 169, p: 0 }} selected={selected} onClick={() => handleClick(item)}>
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: 169,
                    height: 166,
                    pt: '24px',
                    px: '15px',
                  }}
                >
                  <Box
                    component="img"
                    src={srcUrl + item.icon}
                    sx={{ width: 48, height: 48, objectFit: 'contain', mb: '12px', border: 0 }}
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
            </Box>
          );
        })}
    </Box>
  );
}

export default LargeImgCardList;
