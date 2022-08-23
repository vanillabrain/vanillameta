import React from 'react';
import { Grid, Card, Typography, CardContent, CardActionArea, CardActions, IconButton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Delete, Edit } from '@mui/icons-material';
import { DialogAlertIconButton } from './button/DialogAlertButton';
import Recommend from '../pages/Data/Recommend';

const CardList = props => {
  const { subActions, ...rest } = props;

  const handleClick = event => {
    if (rest.onUpdate !== undefined) {
      rest.onUpdate({ dataSource: event.currentTarget.value });
    }
    // console.log(rest.selectedValue, 'selected');
  };

  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${rest.minWidth || '3, 1fr'})` },
      }}
    >
      {rest.data.map !== undefined
        ? rest.data.map(item => (
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
                      rest.selectedData.dataSource === item.id
                        ? theme => `0 0 0 3px ${theme.palette.primary.main} inset`
                        : 'none',
                    minHeight: 80,
                    px: 2,
                  }}
                  {...rest}
                >
                  <CardContent sx={{ p: 0, pl: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{ width: '40%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {item.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                {subActions}
              </Card>
            </Grid>
          ))
        : ''}
    </Grid>
  );
};

CardList.defaultProps = {
  // data: [{ id: 0, name: '' }],
  subActions: '',
  selectedData: '',
  dataSource: 0,
};

export default CardList;

export const IconCardList = props => {
  const { button, ...rest } = props;

  return (
    <CardList
      subActions={
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
          {button}
        </CardActions>
      }
      {...rest}
    />
  );
};

export const DataSetCard = props => {
  const { data, ...rest } = props;
  console.log(rest);

  // const handleClick = event => {
  //   if (rest.onUpdate !== undefined) {
  //     rest.onUpdate({ dataSource: event.currentTarget.value });
  //   }
  //   // console.log(rest.selectedValue, 'selected');
  // };
  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
      }}
    >
      {data.map
        ? data.map(item => (
            <Grid item xs={12} md component="li" key={item.id}>
              <Card
                sx={{
                  position: 'relative',
                }}
                {...rest}
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
                      width: '40%',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </Typography>
                </CardContent>

                {/* 아이콘 */}
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
              </Card>
            </Grid>
          ))
        : ''}
    </Grid>
  );
};

DataSetCard.defaultProps = {
  data: {
    id: '',
    name: '',
  },
};

export const DataSourceCard = props => {
  const { data, onUpdate, selectedData, ...rest } = props;
  console.log(rest);

  const handleClick = event => {
    if (onUpdate !== undefined) {
      onUpdate({ dataSource: event.currentTarget.value });
    }
    // console.log(rest.selectedValue, 'selected');
  };

  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat("100%")' },
      }}
    >
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
                      selectedData.dataSource === item.id
                        ? theme => `0 0 0 3px ${theme.palette.primary.main} inset`
                        : 'none',
                    minHeight: 80,
                    px: 2,
                  }}
                  {...rest}
                >
                  <CardContent sx={{ p: 0, pl: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{ width: '40%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {item.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>

                {/* 아이콘 */}
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
                  <Recommend name={item.id} />
                  <IconButton size="medium" component={RouterLink} to={`/data/set/modify/${item.id}`}>
                    <Edit />
                  </IconButton>
                  <DialogAlertIconButton icon={<Delete />}>{item.name} 을 삭제하시겠습니까?</DialogAlertIconButton>
                </CardActions>
              </Card>
            </Grid>
          ))
        : ''}
    </Grid>
  );
};

DataSourceCard.defaultProps = {
  data: {
    id: '',
    name: '',
  },
};
