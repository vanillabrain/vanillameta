import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import BoardList from '@/components/BoardList';
import { Outlet, useParams } from 'react-router-dom';
import AddIconButton from '@/components/button/AddIconButton';

const title = '대시보드';

function Dashboard(props) {
  const { dashboard_id } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [loadedCount, setLoadedCount] = useState(1);

  useEffect(() => {
    fetch('/data/dummyDashboardList.json')
      .then(response => response.json())
      .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      {!dashboard_id ? (
        <PageTitleBox title={title} button={<AddIconButton link="/dashboard/create" />}>
          <BoardList postList={loadedWidgetData} />
        </PageTitleBox>
      ) : (
        <Outlet />
      )}
    </PageContainer>
  );
}

export default Dashboard;
