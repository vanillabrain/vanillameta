import React from 'react';
import { IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { BarChart, PieChart, Dashboard, Delete, Edit } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const name = props.postList.name;
  const dateData = data => {
    const userDate = new Date(data);
    const year = userDate.getFullYear();
    const month = userDate.getMonth() + 1;
    const date = userDate.getDate();
    return `${year}-${month >= 10 ? month : '0' + month}-${date >= 10 ? date : '0' + date}`;
  };

  let iconType;
  switch (props.postList.type) {
    case 'dashboard':
      iconType = <Dashboard />;
      break;
    case 'barChart':
      iconType = <BarChart />;
      break;
    case 'pieChart':
      iconType = <PieChart />;
      break;
    default:
      break;
  }

  return (
    <ListItem
      key={props.postList.id}
      secondaryAction={
        <React.Fragment>
          <IconButton size="large" component={RouterLink} to={`/${props.url}/modify`}>
            <Edit />
          </IconButton>
          <IconButton size="large">
            <Delete />
          </IconButton>
        </React.Fragment>
      }
      disablePadding
      sx={{
        borderBottom: tableBorder,
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <ListItemButton sx={{ py: 0.8 }} component={RouterLink} to={`/${props.url}/${props.postList.id}`}>
        {props.postList.type ? <ListItemIcon>{iconType}</ListItemIcon> : ''}
        <ListItemText
          primary={name}
          primaryTypographyProps={{ fontWeight: 500 }}
          secondary={dateData(props.postList.date)}
          sx={{
            display: { xs: 'block', sm: 'flex' },
            justifyContent: 'space-between',
            ml: { xs: 0, sm: 2 },
            mr: 12,
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export default BoardListItem;
