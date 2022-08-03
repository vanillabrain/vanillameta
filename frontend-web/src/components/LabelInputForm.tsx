import React from 'react';
import { List, ListItem, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// const StyledListItem = styled(ListItem)(({ theme }) => ({
//   // width: `${props.width} && '100%'`,
//
//   '& .MuiTypography-root': {
//     display: 'block',
//     minWidth: 120,
//   },
//   '& .MuiTextField-root': {
//     backgroundColor: '#fff',
//   },
// }));

function LabelInputForm(props) {
  return (
    <List sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {props.data.map(item => (
        <ListItem sx={{ width: { xs: '100%', sm: item.width || '100%' } }}>
          {/*<Typography variant="body2" sx={{ minWidth: 100 }}>*/}
          {/*  {item.label}*/}
          {/*</Typography>*/}
          <TextField
            id={item.id}
            label={item.label}
            type={item.type || 'none'}
            sx={{ backgroundColor: '#fff' }}
            required
            fullWidth
          />
        </ListItem>
      ))}
    </List>
  );
}

export default LabelInputForm;
