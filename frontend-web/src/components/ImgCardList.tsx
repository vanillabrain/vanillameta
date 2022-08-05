import React, { useEffect, useState } from 'react';
import { Box, Card, Typography, CardContent, CardActionArea, Stack } from '@mui/material';

function ImgCardList(props) {
  const srcUrl = '/assets/images/logo/';
  const [selectedValue, setSelectedValue] = useState('');

  // useEffect(() => {
  //   props.inputValue(selectedValue);
  // }, [selectedValue]);

  const handleClick = event => {
    setSelectedValue(event.currentTarget.value);
    console.log(selectedValue);
  };

  return (
    <Stack
      direction="row"
      justifyContent="center"
      flexWrap="wrap"
      component="ul"
      sx={{ maxWidth: '100%', listStyle: 'none', m: '16px auto', p: 0, gap: { xs: 2, md: 3 } }}
    >
      {props.data.map(item => (
        <Box component="li" key={item.key} sx={{ minWidth: { xs: 100, md: 130 }, my: 0 }}>
          <Card>
            <CardActionArea
              onClick={handleClick}
              value={item.value}
              sx={{
                boxShadow: selectedValue === item.value ? theme => `0 0 0 3px ${theme.palette.primary.main} inset` : 'none',
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: { xs: 140, md: 170 },
                }}
              >
                <Box
                  component="img"
                  src={srcUrl + item.src}
                  sx={{ width: 80, height: 60, objectFit: 'contain', mb: 2, border: 0 }}
                />
                <Typography variant="subtitle2" component="span">
                  {item.value}
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
