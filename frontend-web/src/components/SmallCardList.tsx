import React, { useState } from 'react';
import { Box, Grid, IconButton, Card, Typography, CardContent, CardActionArea, CardActions } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Recommend from '../pages/Data/Recommend';

function CardList(props) {
  const [selectedValue, setSelectedValue] = useState('');

  const handleClick = async event => {
    // await setSelectedValue(event.currentTarget.value);
    console.log(event.currentTarget.value, 'value');
    await setSelectedValue(event.currentTarget.value);
    console.log(selectedValue, 'state');
  };

  const iconActionArea = (
    <CardActions
      disableSpacing
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 10,
        display: 'flex',
        justifyContent: 'flex-end,',
        m: 0,
        p: 0,
      }}
    >
      {props.fastCreate && <Recommend />}
      {props.edit && (
        <IconButton size="small">
          <EditIcon />
        </IconButton>
      )}
      {props.delete && (
        <IconButton size="small">
          <DeleteIcon />
        </IconButton>
      )}
    </CardActions>
  );

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
        <Grid item xs={12} sm={4} md={2} component="li" key={item.key}>
          <Card
            sx={{
              position: 'relative',
            }}
          >
            <CardActionArea
              onClick={handleClick}
              value={item.value}
              sx={{
                boxShadow: selectedValue === item.value ? theme => `0 0 0 3px ${theme.palette.primary.main} inset` : 'none',
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
                  {item.label}
                </Typography>
              </CardContent>
            </CardActionArea>
            {iconActionArea}
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default CardList;
