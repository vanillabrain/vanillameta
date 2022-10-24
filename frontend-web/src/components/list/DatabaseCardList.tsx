import React, { Fragment } from 'react';
import { Card, CardActionArea, CardActions, CardContent, Grid, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import { any } from 'prop-types';
import { ReactComponent as IconDatabase } from '@/assets/images/icon/ic-data.svg';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';

export const DatabaseCardList = props => {
  const { data, onUpdate, selectedDatabase, minWidth, disabledIcons, onRemove } = props;

  const handleClick = id => {
    if (onUpdate !== undefined) {
      onUpdate({ databaseId: id });
    }
  };

  return (
    <CardListWrapper minWidth={minWidth}>
      {data.map
        ? data.map(item => {
            const selected = selectedDatabase.databaseId == item.id;
            return (
              <Grid item xs={12} md component="li" key={item.id}>
                <CardWrapper selected={selected} onClick={() => handleClick(item.id)}>
                  <CardContent sx={{ p: '0 !important', alignItems: 'center', display: 'flex' }}>
                    <IconDatabase />
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{
                        pl: '10px',
                        width: disabledIcons ? '100%' : '40%',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </Typography>
                  </CardContent>

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
                      <ModifyButton size="medium" component={RouterLink} to={`/data/source/modify/${item.id}`} />
                      <DeleteButton
                        size="medium"
                        onClick={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          onRemove(item.id, item.name);
                        }}
                      />
                    </CardActions>
                  )}
                </CardWrapper>
              </Grid>
            );
          })
        : ''}
    </CardListWrapper>
  );
};

DatabaseCardList.defaultProps = {
  data: any,
  minWidth: false,
  disabledIcons: false,
};
