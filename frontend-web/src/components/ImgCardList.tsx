import React from 'react';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';

function ImgCardList(props) {
  const { data, size, selectedType, setSelectedType, handleNext } = props;
  const srcUrl = '/assets/images/';

  const handleClick = item => {
    setSelectedType(item);
  };

  return (
    <Stack
      direction="row"
      justifyContent="center"
      flexWrap="wrap"
      component="ul"
      sx={{ maxWidth: '100%', listStyle: 'none', m: '16px auto', p: 0, gap: { xs: 2, md: 3 } }}
    >
      {data.map(item => (
        <Box component="li" key={item.id} sx={size === 'large' ? { width: { xs: 100, md: 130 }, my: 0 } : { width: 150 }}>
          <Card>
            <CardActionArea
              onClick={!handleNext ? () => handleClick(item) : event => handleNext(event, item)}
              value={item.id}
              sx={{
                boxShadow:
                  selectedType && selectedType.id === item.id
                    ? theme => `0 0 0 3px ${theme.palette.primary.main} inset`
                    : 'none',
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: props.large ? { xs: 140, md: 170 } : 200,
                }}
              >
                <Box
                  component="img"
                  src={srcUrl + item.icon}
                  sx={{ width: 80, height: 60, objectFit: 'contain', mb: 3, border: 0 }}
                />
                <Typography variant="subtitle2" component="span" sx={{ textAlign: 'center' }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', color: theme => theme.palette.grey.A700 }}>
                  {item.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
      ))}
    </Stack>
  );
}

export default ImgCardList;
