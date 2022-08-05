import React from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import PageContainer from '../../components/PageContainer';
import TitleBox from '../../components/TitleBox';
import BoardList from '../../components/BoardList';

const title = '위젯';
const naviUrl = '/widget/create';

const postList = [
  {
    id: 1,
    title: '위젯1',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 2,
    title: '테스트 위젯 테스트 위젯',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 3,
    title: '테스트 대시보드',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 4,
    title: '그래프 차트',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 5,
    title: 'STARFLEET HEADQUARTERS ',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 6,
    title: 'IONIC CANNON ',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 7,
    title: 'CORE ',
    date: '22.08.04',
    type: 'dashboard',
  },
  {
    id: 8,
    title: 'Advenas crescere!',
    date: '22.08.04',
    type: 'barChart',
  },
  {
    id: 9,
    title: '테스트 제목 테스트 제목 테스트 제목',
    date: '22.08.04',
    type: 'pieChart',
  },
  {
    id: 10,
    title: 'NANOMACHINE ',
    date: '22.08.04',
    type: 'barChart',
  },
  // {
  //   id: 11,
  //   title: '위젯3',
  //   date: '22.08.04',
  //   type: 'pieChart',
  // },
  // {
  //   id: 12,
  //   title: '위젯1',
  //   date: '22.08.04',
  //   type: 'dashboard',
  // },
  // {
  //   id: 13,
  //   title: '위젯2',
  //   date: '22.08.04',
  //   type: 'barChart',
  // },
  // {
  //   id: 14,
  //   title: '위젯3',
  //   date: '22.08.04',
  //   type: 'pieChart',
  // },
];

function Widget() {
  return (
    <PageContainer>
      <TitleBox title={title} naviUrl={naviUrl}>
        <BoardList postList={postList} />
      </TitleBox>
    </PageContainer>
  );
}

export default Widget;
