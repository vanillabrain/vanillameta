import { CardActions, CardContent, Grid, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import React from 'react';
import CardListWrapper, { CardWrapper } from '@/components/list/CardListWrapper';
import { any } from 'prop-types';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';

export const DatasetCardList = props => {
  const { data, minWidth, disabledIcons, selectedDataset, onSelectDataset, onDeleteDataset } = props;

  return (
    <CardListWrapper minWidth={minWidth}>
      {data.map
        ? data.map(item => {
            const selected = selectedDataset?.id == item.id;
            return (
              <Grid item xs={12} md component="li" key={item.id}>
                <CardWrapper selected={selected} onClick={() => onSelectDataset(item)}>
                  <CardContent
                    sx={{
                      p: '0 !important',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
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
                      {item.title || item.tableName}
                    </Typography>
                  </CardContent>

                  {/* 아이콘 */}
                  {disabledIcons ? (
                    <></>
                  ) : (
                    <CardActions
                      disableSpacing
                      sx={{
                        top: 0,
                        bottom: 0,
                        right: 10,
                        display: 'flex',
                        justifyContent: 'end',
                        width: '100%',
                        m: 0,
                        p: 0,
                      }}
                    >
                      <ModifyButton
                        size="medium"
                        component={RouterLink}
                        to={`/data/set/modify/${item.id}`}
                        width="20"
                        height="20"
                        fill="#767676"
                      />
                      <DeleteButton
                        size="medium"
                        onClick={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteDataset(item);
                        }}
                        width="20"
                        height="20"
                        fill="#767676"
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

DatasetCardList.defaultProps = {
  data: any,
  minWidth: false,
  disabledIcons: false,
};
