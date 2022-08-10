import React from 'react';
import { IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { BarChart, PieChart, Dashboard, Delete, Edit } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const IconType = () => {
    switch (props.postList.type) {
      case 'dashboard':
        return <Dashboard />;
      case 'barChart':
        return <BarChart />;
      case 'pieChart':
        return <PieChart />;
      default:
        return;
    }
  };

  return (
    <ListItem
      key={props.postList.id}
      secondaryAction={
        <React.Fragment>
          <IconButton size="large" component={RouterLink} to={'/widget/modify'}>
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
      <ListItemButton sx={{ py: 0.8 }} component={RouterLink} to={`/widget/${props.postList.id}`}>
        <ListItemIcon>{IconType()}</ListItemIcon>
        <ListItemText
          primary={props.postList.title}
          primaryTypographyProps={{ fontWeight: 500 }}
          secondary={props.postList.date}
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
