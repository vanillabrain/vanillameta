import React from 'react';
import { Box, Grid, List, ListItem, ListItemText, ListItemButton, ListSubheader, Paper, Stack, styled } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const StyledPaper = styled(Paper)(({ theme }) => ({
  minHeight: 500,
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#eee',
  ...theme.typography.body2,
  padding: 0,
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  maxWidth: 200,
  borderRadius: 10,
  fontSize: 14,
  backgroundColor: '#ddd',
}));

const chipList = (
  <StyledPaper>
    <List sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1, columnGap: 3, padding: 0, justifyContent: 'space-around' }}>
      <ListSubheader
        sx={{
          width: '100%',
          height: 50,
          marginBottom: 2,
          // borderTopLeftRadius: 4,
          // borderTopRightRadius: 4,
          fontSize: 16,
          fontWeight: 700,
          backgroundColor: '#fff',
        }}
      >
        데이터베이스 헤더
      </ListSubheader>
      <StyledListItem>
        <ListItemButton>
          <ListItemText primary="데이터베이스" />
          <EditIcon />
          <DeleteIcon />
        </ListItemButton>
      </StyledListItem>
      <StyledListItem>
        <ListItemButton>
          <ListItemText primary="데이터베이스" />
          <EditIcon />
          <DeleteIcon />
        </ListItemButton>
      </StyledListItem>
      <StyledListItem>
        <ListItemButton>
          <ListItemText primary="데이터베이스" />
          <EditIcon />
          <DeleteIcon />
        </ListItemButton>
      </StyledListItem>
    </List>
  </StyledPaper>
);

function Data() {
  return (
    <Box p={10} pt={6}>
      <Grid container spacing={3}>
        <Grid item xs={3} sx={{ minWidth: 240 }}>
          {chipList}
        </Grid>
        <Grid item xs sx={{ minWidth: 400 }}>
          {chipList}
        </Grid>
      </Grid>
    </Box>
  );
}

export default Data;
