import React, { useEffect, useState } from 'react';
import { Box, List, Pagination, Stack, useMediaQuery, useTheme } from '@mui/material';
import BoardItem from './BoardItem';
import { styled } from '@mui/system';
import { MAX_WIDTH } from '@/constant';

interface GTSpanProps {
  children: React.ReactNode;
  matches?: boolean;
  isWidget?: boolean;
}

// TODO: 오류 수정
const GTSpan = styled('span')<GTSpanProps>(props => ({
  marginLeft: props.matches && props.isWidget && '50px',
  fontSize: props.matches ? '13px' : '10px',
  fontWeight: '500',
  lineHeight: '1.23',
  color: '#767676',
}));

const tableBorder = '1px solid #DADDDD';

function BoardList(props) {
  const { postList, handleDeleteSelect } = props;
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTotalCount(Math.ceil(postList.length / 10));
  }, [postList]);

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

  const handlePageChange = (e, p) => {
    setPage(p);
  };

  const generateBoardItem = () => {
    return postList.map((item, index) => {
      const currPage = (page - 1) * 10;
      if (index >= currPage && index < currPage + 10) {
        return <BoardItem data={item} key={item.id} handleDeleteSelect={handleDeleteSelect} />;
      } else {
        return null;
      }
    });
  };

  return (
    <Box sx={{ maxWidth: MAX_WIDTH, width: '100%', mx: 'auto' }}>
      <Stack
        flexDirection="row"
        justifyContent="space-between"
        sx={{
          width: '100%',
          paddingLeft: '20px',
          paddingRight: { xs: '60px', sm: '216px' },
          marginBottom: '11px',
          marginTop: { xs: '21px', sm: '36px' },
        }}
      >
        <GTSpan isWidget={Boolean(postList?.[0]?.componentType)} matches={matches}>
          이름
        </GTSpan>
        <GTSpan matches={matches}>수정일</GTSpan>
      </Stack>
      <List sx={{ width: '100%', m: 'auto', border: tableBorder, borderRadius: 2, backgroundColor: '#fff' }} disablePadding>
        {generateBoardItem()}
      </List>
      <Stack alignItems="center" sx={{ marginTop: '47px' }}>
        <Pagination count={totalCount} page={page} shape="rounded" onChange={handlePageChange} />
      </Stack>
    </Box>
  );
}

export default BoardList;
