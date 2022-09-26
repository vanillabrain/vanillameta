import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useParams } from 'react-router-dom';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import { get } from '@/helpers/apiHelper';

const title = '대시보드';

function Dashboard(props) {
  const { dashboard_id } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  const menuList = [
    { name: '대시보드', link: '/dashboard/create' },
    { name: '대시보드 추천', link: '/data/source/create' },
  ];

  useEffect(() => {
    get('/data/dummyDashboardList.json')
      .then(response => response.data)
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  const handleDeleteSelect = item => {
    // todo 삭제 로직 넣기
    console.log('삭제버튼 눌렀다');
    console.log(item);
  };
  return (
    <PageContainer>
      {!dashboard_id ? (
        <PageTitleBox title={title} button={<AddMenuIconButton menuList={menuList} />}>
          <BoardList postList={loadedWidgetData} handleDeleteSelect={handleDeleteSelect} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
