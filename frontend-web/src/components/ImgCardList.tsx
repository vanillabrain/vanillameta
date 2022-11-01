import React from 'react';
import { Box, CardContent, Typography } from '@mui/material';
import { CardWrapper } from '@/components/list/CardListWrapper';

function ImgCardList(props) {
  const { data, minWidth, selectedType, setSelectedType } = props;
  const srcUrl = '/static/images/';

  const handleClick = item => {
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
      {data.map(item => {
        const selected = selectedType && selectedType.id === item.id;
        return (
          <Box component="li" key={item.id}>
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
          </Box>
        );
      })}
    </Box>
  );
}

export default ImgCardList;
