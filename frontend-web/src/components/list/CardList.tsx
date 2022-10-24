import React from 'react';
import { Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import CardListWrapper from '@/components/list/CardListWrapper';

const CardList = props => {
  const { subActions, minWidth, data, setValue, selectDataset } = props;

  const handleClick = event => {
    if (setValue !== undefined) {
      setValue(event.currentTarget.value);
    }
  };

  return (
    <CardListWrapper minWidth={minWidth}>
      {data.map !== undefined
        ? data.map(item => (
            <Grid item xs={12} md component="li" key={item.id}>
              <Card
                sx={{
                  position: 'relative',
                }}
              >
                <CardActionArea
                  onClick={() => selectDataset(item)}
                  sx={{
                    minHeight: 80,
                    px: 2,
                  }}
                  value={item.id}
                >
                  <CardContent sx={{ p: 0, pl: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{ width: '40%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {item.id}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                {subActions}
              </Card>
            </Grid>
          ))
        : ''}
    </CardListWrapper>
  );
};

CardList.defaultProps = {
  data: [{ id: 0, name: '' }],
  subActions: '',
  minWidth: false,
};

export default CardList;
