import React from 'react';
import { Box, Grid, List, Pagination, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import BoardListItem from './BoardListItem';

function BoardList(props) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const tableBorder = '1px solid #DADDDD';

  return (
    <Box>
      <Grid
        container
        spacing={2}
        gridTemplateColumns={{ xs: '58px auto', sm: '74px auto 240px' }} // TODO: 하드코딩 고칠 수 있으면 고칠 것
        sx={{
          display: 'grid',
          m: 'auto',
          ml: 2,
          mr: 18,
          pb: 1,
          '& .MuiGrid-root': { p: 0 },
        }}
      >
        <Grid item>
          <Typography variant="body2">종류</Typography>
        </Grid>
        <Grid item>
          <Typography variant="body2">이름</Typography>
        </Grid>
        <Grid item>{matches && <Typography variant="body2">수정한 날짜</Typography>}</Grid>
      </Grid>
      <List sx={{ m: 'auto', border: tableBorder, borderRadius: 2, backgroundColor: '#fff' }} disablePadding>
        {props.postList.map(item => (
          <BoardListItem postList={item} key={item.id} />
        ))}
      </List>
      <Stack alignItems="center" mt={4}>
        <Pagination count={10} />
      </Stack>
    </Box>
  );
}

export default BoardList;
