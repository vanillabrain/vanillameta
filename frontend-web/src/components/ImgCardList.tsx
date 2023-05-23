import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

const CardWrapper = ({ children, selected, onClick, sx = null }) => {
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

function ImgCardList(props) {
  const { data, selectedType, handleTypeClick } = props;
  const srcUrl = '/static/images/';

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
            <CardWrapper sx={{ p: 0 }} selected={selected} onClick={() => handleTypeClick(item)}>
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
