import React from 'react';
import { Box, List, Pagination, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import BoardListItem from './BoardListItem';

function BoardList(props) {
  const { postList, ...rest } = props;

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const tableBorder = '1px solid #DADDDD';

  // 위젯 종류 아이콘이 있는 위젯 목록과 없는 대시보드의 레이아웃이 다르므로
  // 종류 항목 여부를 기준으로 레이아웃을 다르게 구현
  const hasItType = postList.filter(item => item.type).length !== 0;

  return (
    <Box>
      <Stack flexDirection="row" justifyContent="space-between" px={4} pb={1}>
        {hasItType && (
          <Typography variant="body2" sx={{ ml: -2 }}>
            종류
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{ flexGrow: 1, pl: hasItType ? { xs: 4, sm: 6 } : 0, ml: hasItType ? 0 : { xs: -2, sm: 0 } }}
        >
          이름
        </Typography>
        {matches && (
          <Typography variant="body2" sx={{ mr: '112px' }}>
            수정한 날짜
          </Typography>
        )}
      </Stack>

      <List sx={{ m: 'auto', border: tableBorder, borderRadius: 2, backgroundColor: '#fff' }} disablePadding>
        {postList.map(item => (
          <BoardListItem postItem={item} key={item.dashboardId} />
        ))}
      </List>
      <Stack alignItems="center" mt={4}>
        <Pagination count={10} />
      </Stack>
    </Box>
  );
}

export default BoardList;
