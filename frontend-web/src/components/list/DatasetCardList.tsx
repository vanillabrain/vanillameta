import { Card, CardActions, CardContent, Grid, IconButton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Delete, Edit } from '@mui/icons-material';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import React from 'react';
import CardListWrapper from '@/components/list/CardListWrapper';

export const DatasetCardList = props => {
  const { data, minWidth, disabledIcons, selectDataset } = props;

  return (
    <CardListWrapper minWidth={minWidth}>
      {data.map
        ? data.map(item => (
            <Grid item xs={12} md component="li" key={item.id}>
              <Card
                sx={{
                  position: 'relative',
                }}
                onClick={() => selectDataset('DATASET', item)}
              >
                <CardContent
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 80,
                    pl: 3,
                    pr: 2,
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
                    {item.title}
                  </Typography>
                </CardContent>

                {/* 아이콘 */}
                {disabledIcons ? null : (
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
                    <IconButton size="medium" component={RouterLink} to={`/data/set/modify/${item.id}`}>
                      <Edit />
                    </IconButton>
                    <DialogAlertIconButton icon={<Delete />}>{item.name} 을 삭제하시겠습니까?</DialogAlertIconButton>
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))
        : ''}
    </CardListWrapper>
  );
};

DatasetCardList.defaultProps = {
  data: {
    id: '',
    name: '',
  },
  minWidth: false,
  disabledIcons: false,
};
