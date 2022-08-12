import React, { useState, useEffect } from 'react';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import BoardList from '../../components/BoardList';
import { Outlet, useParams } from 'react-router-dom';

const title = '대시보드';
const naviUrl = '/dashboard/create';

const postList = [
  {
    id: 1,
    title: '대시보드1',
    date: '22.08.04',
  },
  {
    id: 2,
    title: '테스트 대시보드 테스트 대시보드',
    date: '22.08.04',
  },
  {
    id: 3,
    title: '테스트 대시보드',
    date: '22.08.04',
  },
  {
    id: 4,
    title: '그래프 차트',
    date: '22.08.04',
  },
  {
    id: 5,
    title: 'STARFLEET HEADQUARTERS ',
    date: '22.08.04',
  },
  {
    id: 6,
    title: 'IONIC CANNON ',
    date: '22.08.04',
  },
  {
    id: 7,
    title: 'CORE ',
    date: '22.08.04',
  },
  {
    id: 8,
    title: 'Advenas crescere!',
    date: '22.08.04',
  },
  {
    id: 9,
    title: '테스트 제목 테스트 제목 테스트 제목',
    date: '22.08.04',
  },
  {
    id: 10,
    title: 'NANOMACHINE ',
    date: '22.08.04',
  },
  // {
  //   id: 11,
  //   title: '대시보드3',
  //   date: '22.08.04',
  // },
  // {
  //   id: 12,
  //   title: '대시보드1',
  //   date: '22.08.04',
  // },
  // {
  //   id: 13,
  //   title: '대시보드2',
  //   date: '22.08.04',
  // },
  // {
  //   id: 14,
  //   title: '대시보드3',
  //   date: '22.08.04',
  // },
];

function Dashboard(props) {
  const [isLoading, setIsLoading] = useState(false);
  const [LoadedWidgetData, setLoadedWidgetData] = useState([]);

  // useEffect(() => {
  //   setIsLoading(true);
  //   fetch('/data/dummyWidgetList.json')
  //     .then(response => response.json())
  //     .then(data => console.log(data));
  // });

  const params = useParams();

  return (
    <PageContainer>
      {!params.id ? (
        <PageTitleBox title={title} naviUrl={naviUrl}>
          <BoardList postList={postList} url="dashboard" />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
