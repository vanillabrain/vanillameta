import React from 'react';
import { IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Dashboard, Delete, Edit } from '@mui/icons-material';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  return (
    <ListItem
      key={props.menuList.id}
      secondaryAction={
        <React.Fragment>
          <IconButton size="large">
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
      <ListItemButton sx={{ py: 0.8 }}>
        <ListItemIcon>
          <Dashboard />
        </ListItemIcon>
        <ListItemText
          primary={props.menuList.title}
          primaryTypographyProps={{ fontWeight: 500 }}
          secondary={props.menuList.date}
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
