import React, { useState } from 'react';
import { Box, Card, Typography, CardContent, CardActionArea, Stack } from '@mui/material';

function ImgCardList(props) {
  const cardWidth = props.cardWidth ? props.cardWidth : 200;
  const [hoverButton, setHoverButton] = useState(null);
  const srcUrl = '/assets/images/logo/';

  const onMouseHandler = event => {
    event.preventDefault();
  };

  const offMouseHandler = event => {
    event.preventDefault();
    setHoverButton(null);
  };

  console.log(props.data);

  return (
    <Stack direction="row" component="ul" sx={{ overflow: 'hidden', listStyle: 'none', m: '0', p: 0, gap: 3 }}>
      {props.data.map(item => (
        <Box component="li" key={item.key} sx={{ minWidth: 130, my: 2 }}>
          <Card>
            <CardActionArea>
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 170,
                }}
              >
                <Box
                  component="img"
                  src={srcUrl + item.src}
                  sx={{ width: 60, height: 60, mb: 2, borderRadius: '100%', border: 0 }}
                />
                <Typography variant="subtitle2" component="span">
                  {item.label}
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
