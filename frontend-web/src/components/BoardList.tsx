import React from 'react';
import { Box, List, Pagination, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import BoardListItem from './BoardListItem';

function BoardList(props) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const tableBorder = '1px solid #DADDDD';

  const hasType = props.postList.filter(item => item.type).length !== 0;

  return (
    <Box>
      <Stack flexDirection="row" justifyContent="space-between" px={4} pb={1}>
        {hasType && (
          <Typography variant="body2" sx={{ ml: -2 }}>
            종류
          </Typography>
        )}
        <Typography variant="body2" sx={{ flexGrow: 1, pl: hasType ? { xs: 4, sm: 6 } : 0 }}>
          이름
        </Typography>
        {matches && (
          <Typography variant="body2" sx={{ mr: '112px' }}>
            수정한 날짜
          </Typography>
        )}
      </Stack>

      <List sx={{ m: 'auto', border: tableBorder, borderRadius: 2, backgroundColor: '#fff' }} disablePadding>
        {props.postList.map(item => (
          <BoardListItem postList={item} key={item.id} url={props.url} />
        ))}
      </List>
      <Stack alignItems="center" mt={4}>
        <Pagination count={10} />
      </Stack>
    </Box>
  );
}

export default BoardList;
