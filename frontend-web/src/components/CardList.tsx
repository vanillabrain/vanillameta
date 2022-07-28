import React from 'react';
import { Box, IconButton, Card, Typography, CardContent, CardActionArea, CardActions } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function CardList(props) {
  const cardWidth = props.cardWidth ? props.cardWidth : '100%';

  const iconActionArea = (
    <CardActions disableSpacing sx={{ pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
      {props.fastCreate ? (
        <IconButton>
          <AutoAwesomeIcon />
        </IconButton>
      ) : (
        ''
      )}
      {props.edit ? (
        <IconButton>
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

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        width: '100%',
        listStyle: 'none',
        p: 0,
        my: 3,
        gap: 3,
      }}
      component="ul"
    >
      {props.data.map(data => (
        <Box component="li" key={data.key} sx={{ width: cardWidth }}>
          <Card>
            <CardActionArea>
              <CardContent>
                <Typography variant="subtitle2">{data.label}</Typography>
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
