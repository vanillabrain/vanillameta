import React, { Fragment } from 'react';
import { Grid, Card, Typography, CardContent, CardActionArea, CardActions, IconButton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Delete, Edit } from '@mui/icons-material';
import { DialogAlertIconButton } from './button/DialogAlertButton';
import Recommend from '../pages/Data/Recommend';

const CardListWrapper = ({ children, minWidth }) => {
  return (
    <Grid
      container
      spacing={2}
      component="ul"
      sx={{
        listStyle: 'none',
        pl: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${minWidth || '3, 1fr'})` },
      }}
    >
      {children}
    </Grid>
  );
};

CardListWrapper.defaultProps = {
  children: '',
  minWidth: false,
};

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

export const DataSetCard = props => {
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

DataSetCard.defaultProps = {
  data: {
    id: '',
    name: '',
  },
  minWidth: false,
  disabledIcons: false,
};

export const DataSourceCard = props => {
  const { data, onUpdate, selectedData, minWidth, disabledIcons, onRemove } = props;

  const handleClick = event => {
    if (onUpdate !== undefined) {
      onUpdate({ databaseId: event.currentTarget.value });
    }
  };

  console.log(selectedData.databaseId, data);
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
                      selectedData.databaseId === item.id
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

DataSourceCard.defaultProps = {
  data: {
    id: '',
    name: '',
  },
  minWidth: false,
  disabledIcons: false,
};
