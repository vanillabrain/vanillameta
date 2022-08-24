import React, { useState } from 'react';
import { Grid, Card, Typography, CardContent, CardActionArea } from '@mui/material';

function SmallCardList(props) {
  const [selectedValue, setSelectedValue] = useState('');

  const handleClick = event => {
    console.log(event.currentTarget.value);
    setSelectedValue(event.currentTarget.value);
  };

  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
      }}
    >
      {props.data.map(item => (
        <Grid item xs={12} sm={4} md={2} component="li" key={item.id}>
          <Card
            sx={{
              position: 'relative',
            }}
          >
            <CardActionArea
              onClick={handleClick}
              value={item.id}
              sx={{
                boxShadow: selectedValue === item.id ? theme => `0 0 0 3px ${theme.palette.primary.main} inset` : 'none',
                minHeight: 60,
                px: 2,
              }}
            >
              <CardContent sx={{ p: 0, pl: 1 }}>
                <Typography
                  component="span"
                  variant="subtitle2"
                  sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {item.name}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default SmallCardList;
