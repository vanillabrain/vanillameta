import React, { useEffect, useState } from 'react';
import { Box, List, Pagination, Stack, useMediaQuery, useTheme } from '@mui/material';
import BoardListItem from './BoardListItem';
import { styled } from '@mui/system';

function BoardList(props) {
  const { postList, handleDeleteSelect } = props;
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTotalCount(Math.ceil(postList.length / 10));
  }, [postList]);

  const GTSpan = styled('span')({
    marginLeft: postList[0]?.componentType && '50px',
    fontFamily: 'Pretendard',
    fontSize: '13px',
    fontWeight: '500',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.23',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#767676',
  });

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const tableBorder = '1px solid #DADDDD';

  const handlePageChange = (e, p) => {
    setPage(p);
  };

  const generateBoardItem = () => {
    return postList.map((item, i) => {
      const currPage = (page - 1) * 10;
      if (i >= currPage && i < currPage + 10) {
        return <BoardListItem postItem={item} key={item.id} handleDeleteSelect={handleDeleteSelect} />;
      } else {
        return null;
      }
    });
  };

  return (
    <Box>
      <Stack
        flexDirection="row"
        justifyContent="space-between"
        sx={{ paddingLeft: '20px', paddingRight: '206px', marginBottom: '11px', marginTop: '36px' }}
      >
        <GTSpan>이름</GTSpan>
        {matches && <GTSpan>수정일</GTSpan>}
      </Stack>
      <List sx={{ m: 'auto', border: tableBorder, borderRadius: 2, backgroundColor: '#fff' }} disablePadding>
        {generateBoardItem()}
      </List>
      <Stack alignItems="center" sx={{ marginTop: '47px' }}>
        <Pagination count={totalCount} page={page} shape="rounded" onChange={handlePageChange} />
      </Stack>
    </Box>
  );
}

export default BoardList;
