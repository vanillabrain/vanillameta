import React, { useState } from 'react';
import { Box, IconButton, Card, Typography, CardContent, CardActionArea, CardActions } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function CardList(props) {
  const cardWidth = props.cardWidth ? props.cardWidth : '100%';
  const [hoverButton, setHoverButton] = useState(null);

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
      {props.fastCreate ? (
        <IconButton size="small">
          <AutoAwesomeIcon />
        </IconButton>
      ) : (
        ''
      )}
      {props.edit ? (
        <IconButton size="small">
          <EditIcon />
        </IconButton>
      ) : (
        ''
      )}
      {props.delete ? (
        <IconButton size="small">
          <DeleteIcon />
        </IconButton>
      ) : (
        ''
      )}
    </CardActions>
  );

  const onMouseHandler = event => {
    event.preventDefault();
    setHoverButton(iconActionArea);
  };

  const offMouseHandler = event => {
    event.preventDefault();
    setHoverButton(null);
  };

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: '0 auto', p: 0 }}>
      {props.data.map(data => (
        <Box component="li" key={data.key} sx={{ my: 2 }}>
          <Card
            sx={{ position: 'relative' }}
            // onMouseOver={onMouseHandler} onMouseLeave={offMouseHandler}
          >
            <CardActionArea sx={{ minHeight: 80, px: 2 }}>
              <CardContent sx={{ p: 0, pl: 1 }}>
                <Typography
                  component="span"
                  variant="subtitle2"
                  sx={{ width: '40%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {data.label}
                </Typography>
              </CardContent>
            </CardActionArea>
            {iconActionArea}
          </Card>
        </Box>
      ))}
    </Box>
  );
}

export default CardList;
