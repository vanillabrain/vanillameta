import React, { Fragment, useEffect } from 'react';
import { Card, CardActionArea, CardActions, CardContent, Grid, IconButton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Delete, Edit } from '@mui/icons-material';
import CardListWrapper from '@/components/list/CardListWrapper';
import { any } from 'prop-types';

export const DatabaseCardList = props => {
  const { data, onUpdate, selectedDatabase, minWidth, disabledIcons, onRemove } = props;

  const handleClick = event => {
    if (onUpdate !== undefined) {
      onUpdate({ databaseId: event.currentTarget.value });
    }
  };

  return (
    <CardListWrapper minWidth={minWidth}>
      {data.map
        ? data.map(item => (
            <Grid item xs={12} md component="li" key={item.id}>
              <Card
                sx={{
                  position: 'relative',
                }}
              >
                <CardActionArea
                  onClick={handleClick}
                  value={item.id}
                  sx={{
                    boxShadow:
                      selectedDatabase.databaseId == item.id
                        ? theme => `0 0 0 3px ${theme.palette.primary.main} inset`
                        : 'none',
                    minHeight: 80,
                    px: 2,
                  }}
                >
                  <CardContent sx={{ p: 0, pl: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{
                        width: disabledIcons ? '100%' : '40%',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>

                {/* 아이콘 */}
                {disabledIcons ? (
                  <Fragment />
                ) : (
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
                    onClick={handleClick}
                  >
                    <IconButton size="medium" component={RouterLink} to={`/data/source/modify/${item.id}`}>
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="medium"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(item.id, item.name);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))
        : ''}
    </CardListWrapper>
  );
};

DatabaseCardList.defaultProps = {
  data: any,
  minWidth: false,
  disabledIcons: false,
};
